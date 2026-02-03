"use server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../drizzle/db";
import {
  Groups,
  GroupMembers,
  EloScores,
  Matches,
  MatchParticipants,
  Lobbies,
  Users,
  LobbyParticipants,
} from "../../drizzle/schema";
import { getUser } from "./server";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  return randomBytes(8).toString("hex").toUpperCase();
}

export async function createGroup(formData: FormData) {
  const user = await getUser();
  const name = formData.get("name")?.toString();

  const inviteCode = generateInviteCode();
  const now = Date.now();

  const group = await db
    .insert(Groups)
    .values({
      name: name || null,
      inviteCode,
      createdAt: now,
      createdBy: user.id,
    })
    .returning()
    .get();

  // Add creator as member
  await db.insert(GroupMembers).values({
    groupId: group.id,
    userId: user.id,
    joinedAt: now,
  });

  return { success: true, group };
}

export async function joinGroup(formData: FormData) {
  const user = await getUser();
  const inviteCode = formData.get("inviteCode")?.toString();

  if (!inviteCode) {
    return { success: false, error: "Invite code is required" };
  }

  const group = await db
    .select()
    .from(Groups)
    .where(eq(Groups.inviteCode, inviteCode))
    .get();

  if (!group) {
    return { success: false, error: "Invalid invite code" };
  }

  // Check if already a member
  const existingMember = await db
    .select()
    .from(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, group.id), eq(GroupMembers.userId, user.id))
    )
    .get();

  if (existingMember) {
    return { success: false, error: "Already a member of this group" };
  }

  await db.insert(GroupMembers).values({
    groupId: group.id,
    userId: user.id,
    joinedAt: Date.now(),
  });

  return { success: true, group };
}

export async function leaveGroup(formData: FormData) {
  const user = await getUser();
  const groupId = Number(formData.get("groupId"));

  if (!groupId) {
    return { success: false, error: "Group ID is required" };
  }

  // Check if user is a member
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

  // Delete membership
  await db
    .delete(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, groupId), eq(GroupMembers.userId, user.id))
    );

  // Delete Elo score
  await db
    .delete(EloScores)
    .where(and(eq(EloScores.groupId, groupId), eq(EloScores.userId, user.id)));

  // Check if group has any members left
  const remainingMembers = await db
    .select()
    .from(GroupMembers)
    .where(eq(GroupMembers.groupId, groupId))
    .all();

  if (remainingMembers.length === 0) {
    // Delete all related data
    const lobbies = await db
      .select({ id: Lobbies.id })
      .from(Lobbies)
      .where(eq(Lobbies.groupId, groupId))
      .all();

    for (const lobby of lobbies) {
      const matches = await db
        .select({ id: Matches.id })
        .from(Matches)
        .where(eq(Matches.lobbyId, lobby.id))
        .all();

      for (const match of matches) {
        await db
          .delete(MatchParticipants)
          .where(eq(MatchParticipants.matchId, match.id));
      }

      await db.delete(Matches).where(eq(Matches.lobbyId, lobby.id));
      await db
        .delete(LobbyParticipants)
        .where(eq(LobbyParticipants.lobbyId, lobby.id));
    }

    await db.delete(Lobbies).where(eq(Lobbies.groupId, groupId));
    await db.delete(Groups).where(eq(Groups.id, groupId));
  }

  return { success: true };
}

export async function getUserGroups() {
  const user = await getUser();

  const memberships = await db
    .select({
      group: Groups,
      joinedAt: GroupMembers.joinedAt,
    })
    .from(GroupMembers)
    .innerJoin(Groups, eq(GroupMembers.groupId, Groups.id))
    .where(eq(GroupMembers.userId, user.id))
    .orderBy(desc(GroupMembers.joinedAt))
    .all();

  return memberships.map((m) => ({
    ...m.group,
    joinedAt: m.joinedAt,
  }));
}

export async function getGroup(groupId: number) {
  const user = await getUser(); // Ensure authenticated

  const group = await db
    .select()
    .from(Groups)
    .where(eq(Groups.id, groupId))
    .get();

  if (!group) {
    throw new Error("Group not found");
  }

  // Check if user is a member
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, groupId), eq(GroupMembers.userId, user.id))
    )
    .get();

  if (!membership) {
    throw new Error("Not a member of this group");
  }

  return group;
}

export async function regenerateInviteCode(formData: FormData) {
  const user = await getUser();
  const groupId = Number(formData.get("groupId"));

  if (!groupId) {
    return { success: false, error: "Group ID is required" };
  }

  // Check if user is a member
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

  const newInviteCode = generateInviteCode();

  await db
    .update(Groups)
    .set({ inviteCode: newInviteCode })
    .where(eq(Groups.id, groupId));

  return { success: true, inviteCode: newInviteCode };
}

export async function getGroupLeaderboard(groupId: number) {
  const user = await getUser(); // Ensure authenticated

  // Check if user is a member
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, groupId), eq(GroupMembers.userId, user.id))
    )
    .get();

  if (!membership) {
    throw new Error("Not a member of this group");
  }

  const scores = await db
    .select({
      elo: EloScores.elo,
      gamesWon: EloScores.gamesWon,
      gamesLost: EloScores.gamesLost,
      gamesTied: EloScores.gamesTied,
      totalGames: EloScores.totalGames,
      currentStreak: EloScores.currentStreak,
      highestStreak: EloScores.highestStreak,
      lastPlayedAt: EloScores.lastPlayedAt,
      user: {
        id: Users.id,
        username: Users.username,
      },
    })
    .from(EloScores)
    .innerJoin(Users, eq(EloScores.userId, Users.id))
    .where(eq(EloScores.groupId, groupId))
    .orderBy(desc(EloScores.elo))
    .all();

  return scores.map((score) => ({
    ...score,
    winPercentage:
      score.totalGames > 0
        ? ((score.gamesWon / score.totalGames) * 100).toFixed(1)
        : "0.0",
  }));
}
