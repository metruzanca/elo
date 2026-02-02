"use server";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db } from "../../drizzle/db";
import {
  Lobbies,
  LobbyParticipants,
  GroupMembers,
  Users,
} from "../../drizzle/schema";
import { getUser } from "./server";
import { sseManager } from "../lib/sse";

export async function createLobby(formData: FormData) {
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

  const lobby = await db
    .insert(Lobbies)
    .values({
      groupId,
      hostId: user.id,
      createdAt: now,
      hostLastSeenAt: now,
    })
    .returning()
    .get();

  // Add creator as participant
  await db.insert(LobbyParticipants).values({
    lobbyId: lobby.id,
    userId: user.id,
    isSpectator: false,
    joinedAt: now,
  });

  return { success: true, lobby };
}

export async function joinLobby(formData: FormData) {
  const user = await getUser();
  const lobbyId = Number(formData.get("lobbyId"));

  if (!lobbyId) {
    return { success: false, error: "Lobby ID is required" };
  }

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    return { success: false, error: "Lobby not found" };
  }

  if (lobby.endedAt) {
    return { success: false, error: "Lobby has ended" };
  }

  // Check if user is a member of the group
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(
        eq(GroupMembers.groupId, lobby.groupId),
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
    .from(LobbyParticipants)
    .where(
      and(
        eq(LobbyParticipants.lobbyId, lobbyId),
        eq(LobbyParticipants.userId, user.id)
      )
    )
    .get();

  if (existingParticipant) {
    return {
      success: false,
      error: "Already a participant in this lobby",
    };
  }

  await db.insert(LobbyParticipants).values({
    lobbyId,
    userId: user.id,
    isSpectator: false,
    joinedAt: Date.now(),
  });

  // Broadcast SSE event
  sseManager.broadcastToLobby(lobbyId, {
    type: "player_joined",
    data: { userId: user.id, username: user.username },
  });

  return { success: true };
}

export async function leaveLobby(formData: FormData) {
  const user = await getUser();
  const lobbyId = Number(formData.get("lobbyId"));

  if (!lobbyId) {
    return { success: false, error: "Lobby ID is required" };
  }

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    return { success: false, error: "Lobby not found" };
  }

  // Host cannot leave (must end lobby instead)
  if (lobby.hostId === user.id) {
    return {
      success: false,
      error: "Host cannot leave. End the lobby instead.",
    };
  }

  await db
    .delete(LobbyParticipants)
    .where(
      and(
        eq(LobbyParticipants.lobbyId, lobbyId),
        eq(LobbyParticipants.userId, user.id)
      )
    );

  // Broadcast SSE event
  sseManager.broadcastToLobby(lobbyId, {
    type: "player_left",
    data: { userId: user.id, username: user.username },
  });

  return { success: true };
}

export async function getLobby(lobbyId: number) {
  const user = await getUser();

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    throw new Error("Lobby not found");
  }

  // Check if user is a member of the group
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(
        eq(GroupMembers.groupId, lobby.groupId),
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
      userId: LobbyParticipants.userId,
      isSpectator: LobbyParticipants.isSpectator,
      joinedAt: LobbyParticipants.joinedAt,
      username: Users.username,
    })
    .from(LobbyParticipants)
    .innerJoin(Users, eq(LobbyParticipants.userId, Users.id))
    .where(eq(LobbyParticipants.lobbyId, lobbyId))
    .all();

  return {
    ...lobby,
    participants,
    isHost: lobby.hostId === user.id,
  };
}

export async function getActiveLobbies(groupId: number) {
  await getUser(); // Ensure authenticated

  const lobbiesList = await db
    .select()
    .from(Lobbies)
    .where(and(eq(Lobbies.groupId, groupId), isNull(Lobbies.endedAt)))
    .orderBy(desc(Lobbies.createdAt))
    .all();

  return lobbiesList;
}

export async function getUserActiveLobby() {
  const user = await getUser();

  const activeLobby = await db
    .select({
      id: Lobbies.id,
      groupId: Lobbies.groupId,
      hostId: Lobbies.hostId,
      createdAt: Lobbies.createdAt,
    })
    .from(LobbyParticipants)
    .innerJoin(Lobbies, eq(LobbyParticipants.lobbyId, Lobbies.id))
    .where(and(eq(LobbyParticipants.userId, user.id), isNull(Lobbies.endedAt)))
    .orderBy(desc(Lobbies.createdAt))
    .get();

  return activeLobby || null;
}

export async function inviteToLobby(formData: FormData) {
  const user = await getUser();
  const lobbyId = Number(formData.get("lobbyId"));
  const userIdsStr = formData.get("userIds")?.toString();

  if (!lobbyId) {
    return { success: false, error: "Lobby ID is required" };
  }

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    return { success: false, error: "Lobby not found" };
  }

  if (lobby.hostId !== user.id) {
    return { success: false, error: "Only the host can invite players" };
  }

  if (lobby.endedAt) {
    return { success: false, error: "Lobby has ended" };
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
          eq(GroupMembers.groupId, lobby.groupId),
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
      .from(LobbyParticipants)
      .where(
        and(
          eq(LobbyParticipants.lobbyId, lobbyId),
          eq(LobbyParticipants.userId, userId)
        )
      )
      .get();

    if (!existing) {
      await db.insert(LobbyParticipants).values({
        lobbyId,
        userId,
        isSpectator: false,
        joinedAt: Date.now(),
      });

      // Broadcast SSE event
      sseManager.broadcastToLobby(lobbyId, {
        type: "lobby_invite",
        data: { userId },
      });
    }
  }

  return { success: true };
}

export async function setSpectator(formData: FormData) {
  const user = await getUser();
  const lobbyId = Number(formData.get("lobbyId"));
  const targetUserId = Number(formData.get("userId"));
  const isSpectator = formData.get("isSpectator") === "true";

  if (!lobbyId || !targetUserId) {
    return {
      success: false,
      error: "Lobby ID and user ID are required",
    };
  }

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    return { success: false, error: "Lobby not found" };
  }

  if (lobby.hostId !== user.id) {
    return { success: false, error: "Only the host can set spectator status" };
  }

  if (lobby.endedAt) {
    return { success: false, error: "Lobby has ended" };
  }

  // Host cannot be a spectator
  if (targetUserId === lobby.hostId) {
    return { success: false, error: "Host cannot be a spectator" };
  }

  await db
    .update(LobbyParticipants)
    .set({ isSpectator })
    .where(
      and(
        eq(LobbyParticipants.lobbyId, lobbyId),
        eq(LobbyParticipants.userId, targetUserId)
      )
    );

  return { success: true };
}

export async function endLobby(formData: FormData) {
  const user = await getUser();
  const lobbyId = Number(formData.get("lobbyId"));

  if (!lobbyId) {
    return { success: false, error: "Lobby ID is required" };
  }

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    return { success: false, error: "Lobby not found" };
  }

  if (lobby.hostId !== user.id) {
    return { success: false, error: "Only the host can end the lobby" };
  }

  if (lobby.endedAt) {
    return { success: false, error: "Lobby already ended" };
  }

  await db
    .update(Lobbies)
    .set({ endedAt: Date.now() })
    .where(eq(Lobbies.id, lobbyId));

  // Broadcast SSE event
  sseManager.broadcastToLobby(lobbyId, {
    type: "lobby_ended",
    data: { lobbyId },
  });

  return { success: true };
}

export async function updateHostLastSeen(lobbyId: number) {
  const user = await getUser();

  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    return;
  }

  if (lobby.hostId === user.id) {
    await db
      .update(Lobbies)
      .set({ hostLastSeenAt: Date.now() })
      .where(eq(Lobbies.id, lobbyId));
  }
}
