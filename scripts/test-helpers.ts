import { eq, and, isNotNull, isNull, desc } from "drizzle-orm";
import { db } from "../drizzle/db";
import {
  Users,
  Groups,
  GroupMembers,
  PlaySessions,
  PlaySessionParticipants,
  Matches,
  MatchParticipants,
  EloScores,
} from "../drizzle/schema";
import { randomBytes } from "crypto";
import {
  balanceTeams,
  selectPlayersForMatch,
  type Player,
} from "../src/lib/elo";

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
 * Create a play session with user as host
 */
export async function createPlaySessionAsUser(
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

  const playSession = await db
    .insert(PlaySessions)
    .values({
      groupId,
      hostId: userId,
      createdAt: now,
      hostLastSeenAt: now,
    })
    .returning()
    .get();

  // Add creator as participant
  await db.insert(PlaySessionParticipants).values({
    playSessionId: playSession.id,
    userId,
    isSpectator: false,
    joinedAt: now,
  });

  return {
    id: playSession.id,
    groupId: playSession.groupId,
    hostId: playSession.hostId,
  };
}

/**
 * Invite user to play session (add as participant)
 */
export async function inviteUserToSession(
  playSessionId: number,
  userId: number
): Promise<void> {
  // Verify play session exists
  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    throw new Error(`Play session with ID ${playSessionId} not found`);
  }

  if (playSession.endedAt) {
    throw new Error(`Play session ${playSessionId} has ended`);
  }

  // Verify user exists and is a member of the group
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
    throw new Error(
      `User ${userId} is not a member of group ${playSession.groupId}`
    );
  }

  // Check if already a participant
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

  if (existing) {
    throw new Error(
      `User ${userId} is already a participant in play session ${playSessionId}`
    );
  }

  await db.insert(PlaySessionParticipants).values({
    playSessionId,
    userId,
    isSpectator: false,
    joinedAt: Date.now(),
  });
}

/**
 * Join play session as user (same as invite, but different name for clarity)
 */
export async function joinPlaySessionAsUser(
  userId: number,
  playSessionId: number
): Promise<void> {
  return inviteUserToSession(playSessionId, userId);
}

/**
 * Start a match in a play session
 */
export async function startMatchAsHost(
  playSessionId: number,
  matchSize: number
): Promise<{
  matchId: number;
  teamAssignment: { team1: Player[]; team2: Player[]; eloDiff: number };
}> {
  if (matchSize % 2 !== 0) {
    throw new Error("Match size must be even for 2 teams");
  }

  // Verify play session exists
  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, playSessionId))
    .get();

  if (!playSession) {
    throw new Error(`Play session with ID ${playSessionId} not found`);
  }

  if (playSession.endedAt) {
    throw new Error(`Play session ${playSessionId} has ended`);
  }

  // Check if there's already an active match
  const activeMatch = await db
    .select()
    .from(Matches)
    .where(
      and(
        eq(Matches.playSessionId, playSessionId),
        isNull(Matches.endedAt),
        eq(Matches.cancelled, false)
      )
    )
    .get();

  if (activeMatch) {
    throw new Error(
      `There is already an active match in play session ${playSessionId}`
    );
  }

  // Get participants with their Elo scores and games played
  const participants = await db
    .select({
      userId: PlaySessionParticipants.userId,
      isSpectator: PlaySessionParticipants.isSpectator,
      username: Users.username,
    })
    .from(PlaySessionParticipants)
    .innerJoin(Users, eq(PlaySessionParticipants.userId, Users.id))
    .where(eq(PlaySessionParticipants.playSessionId, playSessionId))
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
            eq(EloScores.groupId, playSession.groupId),
            eq(EloScores.userId, p.userId)
          )
        )
        .get();

      // Count games played in this session (completed matches only)
      const completedMatches = await db
        .select({ id: Matches.id })
        .from(Matches)
        .where(
          and(
            eq(Matches.playSessionId, playSessionId),
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
      playSessionId,
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
          eq(EloScores.groupId, playSession.groupId),
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
          eq(EloScores.groupId, playSession.groupId),
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
 * List all play sessions with participant count
 */
export async function listPlaySessions(): Promise<
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
  const sessions = await db
    .select({
      session: PlaySessions,
      hostUsername: Users.username,
    })
    .from(PlaySessions)
    .innerJoin(Users, eq(PlaySessions.hostId, Users.id))
    .orderBy(PlaySessions.id)
    .all();

  const sessionsWithParticipants = await Promise.all(
    sessions.map(async (s) => {
      const participants = await db
        .select()
        .from(PlaySessionParticipants)
        .where(eq(PlaySessionParticipants.playSessionId, s.session.id))
        .all();

      const status: "active" | "ended" = s.session.endedAt ? "ended" : "active";
      return {
        id: s.session.id,
        groupId: s.session.groupId,
        hostId: s.session.hostId,
        hostUsername: s.hostUsername,
        status,
        participantCount: participants.length,
        createdAt: s.session.createdAt,
        endedAt: s.session.endedAt,
      };
    })
  );

  return sessionsWithParticipants;
}
