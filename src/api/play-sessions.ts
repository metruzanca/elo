"use server";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../../drizzle/db";
import {
  PlaySessions,
  PlaySessionParticipants,
  GroupMembers,
  Users,
} from "../../drizzle/schema";
import { getUser } from "./server";
import { sseManager } from "../lib/sse";

export async function createPlaySession(formData: FormData) {
  const user = await getUser();
  const groupId = Number(formData.get("groupId"));

  if (!groupId) {
    return { success: false, error: "Group ID is required" };
  }

  // Check if user is a member of the group
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, groupId), eq(GroupMembers.userId, user.id))
    )
    .get();

  if (!membership) {
    return { success: false, error: "Not a member of this group" };
  }

  const now = Date.now();

  const playSession = await db
    .insert(PlaySessions)
    .values({
      groupId,
      hostId: user.id,
      createdAt: now,
      hostLastSeenAt: now,
    })
    .returning()
    .get();

  // Add creator as participant
  await db.insert(PlaySessionParticipants).values({
    playSessionId: playSession.id,
    userId: user.id,
    isSpectator: false,
    joinedAt: now,
  });

  return { success: true, playSession };
}

export async function joinPlaySession(formData: FormData) {
  const user = await getUser();
  const playSessionId = Number(formData.get("playSessionId"));

  if (!playSessionId) {
    return { success: false, error: "Play session ID is required" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.endedAt) {
    return { success: false, error: "Play session has ended" };
  }

  // Check if user is a member of the group
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(
        eq(GroupMembers.groupId, playSession.groupId),
        eq(GroupMembers.userId, user.id)
      )
    )
    .get();

  if (!membership) {
    return { success: false, error: "Not a member of this group" };
  }

  // Check if already a participant
  const existingParticipant = await db
    .select()
    .from(PlaySessionParticipants)
    .where(
      and(
        eq(PlaySessionParticipants.playSessionId, playSessionId),
        eq(PlaySessionParticipants.userId, user.id)
      )
    )
    .get();

  if (existingParticipant) {
    return {
      success: false,
      error: "Already a participant in this play session",
    };
  }

  await db.insert(PlaySessionParticipants).values({
    playSessionId,
    userId: user.id,
    isSpectator: false,
    joinedAt: Date.now(),
  });

  // Broadcast SSE event
  sseManager.broadcastToPlaySession(playSessionId, {
    type: "player_joined",
    data: { userId: user.id, username: user.username },
  });

  return { success: true };
}

export async function leavePlaySession(formData: FormData) {
  const user = await getUser();
  const playSessionId = Number(formData.get("playSessionId"));

  if (!playSessionId) {
    return { success: false, error: "Play session ID is required" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  // Host cannot leave (must end session instead)
  if (playSession.hostId === user.id) {
    return {
      success: false,
      error: "Host cannot leave. End the session instead.",
    };
  }

  await db
    .delete(PlaySessionParticipants)
    .where(
      and(
        eq(PlaySessionParticipants.playSessionId, playSessionId),
        eq(PlaySessionParticipants.userId, user.id)
      )
    );

  // Broadcast SSE event
  sseManager.broadcastToPlaySession(playSessionId, {
    type: "player_left",
    data: { userId: user.id, username: user.username },
  });

  return { success: true };
}

export async function getPlaySession(playSessionId: number) {
  const user = await getUser();

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    throw new Error("Play session not found");
  }

  // Check if user is a member of the group
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(
        eq(GroupMembers.groupId, playSession.groupId),
        eq(GroupMembers.userId, user.id)
      )
    )
    .get();

  if (!membership) {
    throw new Error("Not a member of this group");
  }

  // Get participants
  const participants = await db
    .select({
      userId: PlaySessionParticipants.userId,
      isSpectator: PlaySessionParticipants.isSpectator,
      joinedAt: PlaySessionParticipants.joinedAt,
      username: Users.username,
    })
    .from(PlaySessionParticipants)
    .innerJoin(Users, eq(PlaySessionParticipants.userId, Users.id))
    .where(eq(PlaySessionParticipants.playSessionId, playSessionId))
    .all();

  return {
    ...playSession,
    participants,
    isHost: playSession.hostId === user.id,
  };
}

export async function getActivePlaySessions(groupId: number) {
  await getUser(); // Ensure authenticated

  const playSessions = await db
    .select()
    .from(PlaySessions)
    .where(and(eq(PlaySessions.groupId, groupId), isNull(PlaySessions.endedAt)))
    .orderBy(desc(PlaySessions.createdAt))
    .all();

  return playSessions;
}

export async function inviteToPlaySession(formData: FormData) {
  const user = await getUser();
  const playSessionId = Number(formData.get("playSessionId"));
  const userIdsStr = formData.get("userIds")?.toString();

  if (!playSessionId) {
    return { success: false, error: "Play session ID is required" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.hostId !== user.id) {
    return { success: false, error: "Only the host can invite players" };
  }

  if (playSession.endedAt) {
    return { success: false, error: "Play session has ended" };
  }

  if (!userIdsStr) {
    return { success: false, error: "User IDs are required" };
  }

  const userIds = userIdsStr.split(",").map((id) => Number(id.trim()));

  // Verify all users are members of the group
  for (const userId of userIds) {
    const membership = await db
      .select()
      .from(GroupMembers)
      .where(
        and(
          eq(GroupMembers.groupId, playSession.groupId),
          eq(GroupMembers.userId, userId)
        )
      )
      .get();

    if (!membership) {
      return {
        success: false,
        error: `User ${userId} is not a member of this group`,
      };
    }

    // Add as participant if not already
    const existing = await db
      .select()
      .from(PlaySessionParticipants)
      .where(
        and(
          eq(PlaySessionParticipants.playSessionId, playSessionId),
          eq(PlaySessionParticipants.userId, userId)
        )
      )
      .get();

    if (!existing) {
      await db.insert(PlaySessionParticipants).values({
        playSessionId,
        userId,
        isSpectator: false,
        joinedAt: Date.now(),
      });

      // Broadcast SSE event
      sseManager.broadcastToPlaySession(playSessionId, {
        type: "play_session_invite",
        data: { userId },
      });
    }
  }

  return { success: true };
}

export async function setSpectator(formData: FormData) {
  const user = await getUser();
  const playSessionId = Number(formData.get("playSessionId"));
  const targetUserId = Number(formData.get("userId"));
  const isSpectator = formData.get("isSpectator") === "true";

  if (!playSessionId || !targetUserId) {
    return {
      success: false,
      error: "Play session ID and user ID are required",
    };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.hostId !== user.id) {
    return { success: false, error: "Only the host can set spectator status" };
  }

  if (playSession.endedAt) {
    return { success: false, error: "Play session has ended" };
  }

  // Host cannot be a spectator
  if (targetUserId === playSession.hostId) {
    return { success: false, error: "Host cannot be a spectator" };
  }

  await db
    .update(PlaySessionParticipants)
    .set({ isSpectator })
    .where(
      and(
        eq(PlaySessionParticipants.playSessionId, playSessionId),
        eq(PlaySessionParticipants.userId, targetUserId)
      )
    );

  return { success: true };
}

export async function endPlaySession(formData: FormData) {
  const user = await getUser();
  const playSessionId = Number(formData.get("playSessionId"));

  if (!playSessionId) {
    return { success: false, error: "Play session ID is required" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.hostId !== user.id) {
    return { success: false, error: "Only the host can end the play session" };
  }

  if (playSession.endedAt) {
    return { success: false, error: "Play session already ended" };
  }

  await db
    .update(PlaySessions)
    .set({ endedAt: Date.now() })
    .where(eq(PlaySessions.id, playSessionId));

  // Broadcast SSE event
  sseManager.broadcastToPlaySession(playSessionId, {
    type: "play_session_ended",
    data: { playSessionId },
  });

  return { success: true };
}

export async function updateHostLastSeen(playSessionId: number) {
  const user = await getUser();

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    return;
  }

  if (playSession.hostId === user.id) {
    await db
      .update(PlaySessions)
      .set({ hostLastSeenAt: Date.now() })
      .where(eq(PlaySessions.id, playSessionId));
  }
}
