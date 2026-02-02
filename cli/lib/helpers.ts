import { eq, and, isNotNull, isNull, desc } from "drizzle-orm";
import { db } from "../../drizzle/db";
import {
  Users,
  Groups,
  GroupMembers,
  Lobbies,
  LobbyParticipants,
  Matches,
  MatchParticipants,
  EloScores,
} from "../../drizzle/schema";
import { randomBytes } from "crypto";
import {
  balanceTeams,
  selectPlayersForMatch,
  type Player,
} from "../../src/lib/elo";

/**
 * Create a test user directly in the database
 */
export async function createTestUser(
  username: string,
  password: string
): Promise<{ id: number; username: string }> {
  // Check if user already exists
  const existing = await db
    .select()
    .from(Users)
    .where(eq(Users.username, username))
    .get();

  if (existing) {
    throw new Error(`User "${username}" already exists`);
  }

  const user = await db
    .insert(Users)
    .values({ username, password })
    .returning()
    .get();

  return { id: user.id, username: user.username };
}

/**
 * Join a group as a user (add to group members)
 */
export async function joinGroupAsUser(
  userId: number,
  groupId: number
): Promise<void> {
  // Verify user exists
  const user = await db.select().from(Users).where(eq(Users.id, userId)).get();
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Verify group exists
  const group = await db
    .select()
    .from(Groups)
    .where(eq(Groups.id, groupId))
    .get();
  if (!group) {
    throw new Error(`Group with ID ${groupId} not found`);
  }

  // Check if already a member
  const existing = await db
    .select()
    .from(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, groupId), eq(GroupMembers.userId, userId))
    )
    .get();

  if (existing) {
    throw new Error(`User ${userId} is already a member of group ${groupId}`);
  }

  await db.insert(GroupMembers).values({
    groupId,
    userId,
    joinedAt: Date.now(),
  });
}

/**
 * Create a lobby with user as host
 */
export async function createLobbyAsUser(
  userId: number,
  groupId: number
): Promise<{ id: number; groupId: number; hostId: number }> {
  // Verify user exists
  const user = await db.select().from(Users).where(eq(Users.id, userId)).get();
  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  // Verify group exists and user is a member
  const membership = await db
    .select()
    .from(GroupMembers)
    .where(
      and(eq(GroupMembers.groupId, groupId), eq(GroupMembers.userId, userId))
    )
    .get();

  if (!membership) {
    throw new Error(`User ${userId} is not a member of group ${groupId}`);
  }

  const now = Date.now();

  const lobby = await db
    .insert(Lobbies)
    .values({
      groupId,
      hostId: userId,
      createdAt: now,
      hostLastSeenAt: now,
    })
    .returning()
    .get();

  // Add creator as participant
  await db.insert(LobbyParticipants).values({
    lobbyId: lobby.id,
    userId,
    isSpectator: false,
    joinedAt: now,
  });

  return {
    id: lobby.id,
    groupId: lobby.groupId,
    hostId: lobby.hostId,
  };
}

/**
 * Invite user to lobby (add as participant)
 */
export async function inviteUserToLobby(
  lobbyId: number,
  userId: number
): Promise<void> {
  // Verify lobby exists
  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    throw new Error(`Lobby with ID ${lobbyId} not found`);
  }

  if (lobby.endedAt) {
    throw new Error(`Lobby ${lobbyId} has ended`);
  }

  // Verify user exists and is a member of the group
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
    throw new Error(`User ${userId} is not a member of group ${lobby.groupId}`);
  }

  // Check if already a participant
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

  if (existing) {
    throw new Error(
      `User ${userId} is already a participant in lobby ${lobbyId}`
    );
  }

  await db.insert(LobbyParticipants).values({
    lobbyId,
    userId,
    isSpectator: false,
    joinedAt: Date.now(),
  });
}

/**
 * Join lobby as user (same as invite, but different name for clarity)
 */
export async function joinLobbyAsUser(
  userId: number,
  lobbyId: number
): Promise<void> {
  return inviteUserToLobby(lobbyId, userId);
}

/**
 * Start a match in a lobby
 */
export async function startMatchAsHost(
  lobbyId: number,
  matchSize: number
): Promise<{
  matchId: number;
  teamAssignment: { team1: Player[]; team2: Player[]; eloDiff: number };
}> {
  if (matchSize % 2 !== 0) {
    throw new Error("Match size must be even for 2 teams");
  }

  // Verify lobby exists
  const lobby = await db
    .select()
    .from(Lobbies)
    .where(eq(Lobbies.id, lobbyId))
    .get();

  if (!lobby) {
    throw new Error(`Lobby with ID ${lobbyId} not found`);
  }

  if (lobby.endedAt) {
    throw new Error(`Lobby ${lobbyId} has ended`);
  }

  // Check if there's already an active match
  const activeMatch = await db
    .select()
    .from(Matches)
    .where(
      and(
        eq(Matches.lobbyId, lobbyId),
        isNull(Matches.endedAt),
        eq(Matches.cancelled, false)
      )
    )
    .get();

  if (activeMatch) {
    throw new Error(`There is already an active match in lobby ${lobbyId}`);
  }

  // Get participants with their Elo scores and games played
  const participants = await db
    .select({
      userId: LobbyParticipants.userId,
      isSpectator: LobbyParticipants.isSpectator,
      username: Users.username,
    })
    .from(LobbyParticipants)
    .innerJoin(Users, eq(LobbyParticipants.userId, Users.id))
    .where(eq(LobbyParticipants.lobbyId, lobbyId))
    .all();

  // Get Elo scores and games played for each participant
  const participantsWithStats = await Promise.all(
    participants.map(async (p) => {
      if (p.isSpectator) {
        return {
          userId: p.userId,
          elo: 1500,
          isSpectator: p.isSpectator,
          gamesPlayed: 0,
        };
      }

      const eloScore = await db
        .select()
        .from(EloScores)
        .where(
          and(
            eq(EloScores.groupId, lobby.groupId),
            eq(EloScores.userId, p.userId)
          )
        )
        .get();

      // Count games played in this lobby (completed matches only)
      const completedMatches = await db
        .select({ id: Matches.id })
        .from(Matches)
        .where(
          and(
            eq(Matches.lobbyId, lobbyId),
            isNotNull(Matches.endedAt),
            eq(Matches.cancelled, false)
          )
        )
        .all();

      let gamesPlayed = 0;
      for (const match of completedMatches) {
        const participant = await db
          .select()
          .from(MatchParticipants)
          .where(
            and(
              eq(MatchParticipants.matchId, match.id),
              eq(MatchParticipants.userId, p.userId)
            )
          )
          .get();
        if (participant) gamesPlayed++;
      }

      return {
        userId: p.userId,
        elo: eloScore?.elo || 1500,
        isSpectator: p.isSpectator,
        gamesPlayed,
      };
    })
  );

  // Select players for match
  const selectedPlayers = selectPlayersForMatch(
    participantsWithStats.filter((p) => !p.isSpectator),
    matchSize
  );

  // Balance teams
  const teamAssignment = balanceTeams(selectedPlayers, matchSize);

  // Create match
  const match = await db
    .insert(Matches)
    .values({
      lobbyId,
      startedAt: Date.now(),
      matchSize,
      cancelled: false,
    })
    .returning()
    .get();

  // Create match participants
  const matchParticipants = [];
  for (const player of teamAssignment.team1) {
    const eloScore = await db
      .select()
      .from(EloScores)
      .where(
        and(
          eq(EloScores.groupId, lobby.groupId),
          eq(EloScores.userId, player.userId)
        )
      )
      .get();

    matchParticipants.push({
      matchId: match.id,
      userId: player.userId,
      team: 0,
      eloBefore: eloScore?.elo || null,
      penalized: false,
    });
  }

  for (const player of teamAssignment.team2) {
    const eloScore = await db
      .select()
      .from(EloScores)
      .where(
        and(
          eq(EloScores.groupId, lobby.groupId),
          eq(EloScores.userId, player.userId)
        )
      )
      .get();

    matchParticipants.push({
      matchId: match.id,
      userId: player.userId,
      team: 1,
      eloBefore: eloScore?.elo || null,
      penalized: false,
    });
  }

  await db.insert(MatchParticipants).values(matchParticipants);

  return {
    matchId: match.id,
    teamAssignment,
  };
}

/**
 * List all users
 */
export async function listUsers(): Promise<
  Array<{ id: number; username: string }>
> {
  const users = await db.select().from(Users).orderBy(Users.id).all();
  return users.map((u) => ({ id: u.id, username: u.username }));
}

/**
 * List all groups with member count
 */
export async function listGroups(): Promise<
  Array<{
    id: number;
    name: string | null;
    inviteCode: string;
    createdBy: number;
    creatorUsername: string;
    memberCount: number;
    createdAt: number;
  }>
> {
  const groups = await db
    .select({
      group: Groups,
      creatorUsername: Users.username,
    })
    .from(Groups)
    .innerJoin(Users, eq(Groups.createdBy, Users.id))
    .orderBy(Groups.id)
    .all();

  const groupsWithMembers = await Promise.all(
    groups.map(async (g) => {
      const members = await db
        .select()
        .from(GroupMembers)
        .where(eq(GroupMembers.groupId, g.group.id))
        .all();

      return {
        id: g.group.id,
        name: g.group.name,
        inviteCode: g.group.inviteCode,
        createdBy: g.group.createdBy,
        creatorUsername: g.creatorUsername,
        memberCount: members.length,
        createdAt: g.group.createdAt,
      };
    })
  );

  return groupsWithMembers;
}

/**
 * List all lobbies with participant count
 */
export async function listLobbies(): Promise<
  Array<{
    id: number;
    groupId: number;
    hostId: number;
    hostUsername: string;
    status: "active" | "ended";
    participantCount: number;
    createdAt: number;
    endedAt: number | null;
  }>
> {
  const lobbies = await db
    .select({
      lobby: Lobbies,
      hostUsername: Users.username,
    })
    .from(Lobbies)
    .innerJoin(Users, eq(Lobbies.hostId, Users.id))
    .orderBy(Lobbies.id)
    .all();

  const lobbiesWithParticipants = await Promise.all(
    lobbies.map(async (l) => {
      const participants = await db
        .select()
        .from(LobbyParticipants)
        .where(eq(LobbyParticipants.lobbyId, l.lobby.id))
        .all();

      const status: "active" | "ended" = l.lobby.endedAt ? "ended" : "active";
      return {
        id: l.lobby.id,
        groupId: l.lobby.groupId,
        hostId: l.lobby.hostId,
        hostUsername: l.hostUsername,
        status,
        participantCount: participants.length,
        createdAt: l.lobby.createdAt,
        endedAt: l.lobby.endedAt,
      };
    })
  );

  return lobbiesWithParticipants;
}
