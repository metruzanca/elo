"use server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../../drizzle/db";
import {
  Matches,
  MatchParticipants,
  PlaySessions,
  PlaySessionParticipants,
  EloScores,
  Users,
} from "../../drizzle/schema";
import { getUser } from "./server";
import {
  balanceTeams,
  selectPlayersForMatch,
  calculateEloChange,
  calculateStreakBonus,
  type Player,
} from "../lib/elo";
import { sseManager } from "../lib/sse";

export async function startMatch(formData: FormData) {
  const user = await getUser();
  const playSessionId = Number(formData.get("playSessionId"));
  const matchSize = Number(formData.get("matchSize"));

  if (!playSessionId || !matchSize) {
    return {
      success: false,
      error: "Play session ID and match size are required",
    };
  }

  if (matchSize % 2 !== 0) {
    return { success: false, error: "Match size must be even for 2 teams" };
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
    return { success: false, error: "Only the host can start a match" };
  }

  if (playSession.endedAt) {
    return { success: false, error: "Play session has ended" };
  }

  // Check if there's already an active match
  const activeMatch = await db
    .select()
    .from(Matches)
    .where(
      and(
        eq(Matches.playSessionId, playSessionId),
        eq(Matches.endedAt, null),
        eq(Matches.cancelled, false)
      )
    )
    .get();

  if (activeMatch) {
    return { success: false, error: "There is already an active match" };
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

      // Count games played in this session
      const sessionMatches = await db
        .select({ id: Matches.id })
        .from(Matches)
        .where(
          and(
            eq(Matches.playSessionId, playSessionId),
            eq(Matches.endedAt, null),
            eq(Matches.cancelled, false)
          )
        )
        .all();

      let gamesPlayed = 0;
      for (const match of sessionMatches) {
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

  return { success: true, match };
}

export async function endMatch(formData: FormData) {
  const user = await getUser();
  const matchId = Number(formData.get("matchId"));
  const winningTeam = Number(formData.get("winningTeam")); // 0 or 1

  if (matchId === undefined || winningTeam === undefined) {
    return { success: false, error: "Match ID and winning team are required" };
  }

  if (winningTeam !== 0 && winningTeam !== 1) {
    return { success: false, error: "Winning team must be 0 or 1" };
  }

  const match = await db
    .select()
    .from(Matches)
    .where(eq(Matches.id, matchId))
    .get();

  if (!match) {
    return { success: false, error: "Match not found" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, match.playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.hostId !== user.id) {
    return { success: false, error: "Only the host can end a match" };
  }

  if (match.endedAt) {
    return { success: false, error: "Match already ended" };
  }

  if (match.cancelled) {
    return { success: false, error: "Match is cancelled" };
  }

  // Get match participants
  const participants = await db
    .select()
    .from(MatchParticipants)
    .where(eq(MatchParticipants.matchId, matchId))
    .all();

  // Calculate team averages
  const team0Players = participants.filter((p) => p.team === 0);
  const team1Players = participants.filter((p) => p.team === 1);

  const team0AvgElo =
    team0Players.reduce((sum, p) => sum + (p.eloBefore || 1500), 0) /
    team0Players.length;
  const team1AvgElo =
    team1Players.reduce((sum, p) => sum + (p.eloBefore || 1500), 0) /
    team1Players.length;

  // Calculate Elo changes
  const updates = [];
  for (const participant of participants) {
    const won = participant.team === winningTeam;
    const opponentAvgElo = participant.team === 0 ? team1AvgElo : team0AvgElo;
    const playerElo = participant.eloBefore || 1500;

    // Get current streak
    const eloScore = await db
      .select()
      .from(EloScores)
      .where(
        and(
          eq(EloScores.groupId, playSession.groupId),
          eq(EloScores.userId, participant.userId)
        )
      )
      .get();

    const currentStreak = eloScore?.currentStreak || 0;
    const streakBonus = won ? calculateStreakBonus(currentStreak) : 0;

    let eloChange = 0;
    if (!participant.penalized || !won) {
      // Penalized players don't gain Elo on win, but can lose on loss
      eloChange = calculateEloChange(
        playerElo,
        opponentAvgElo,
        won,
        streakBonus
      );
    }

    const newElo = playerElo + eloChange;

    // Update Elo score
    if (eloScore) {
      const newStreak = won ? Math.min(currentStreak + 1, 3) : 0; // Reset on loss, cap at 3 for bonus
      const highestStreak = Math.max(eloScore.highestStreak, newStreak);

      await db
        .update(EloScores)
        .set({
          elo: newElo,
          gamesWon: won ? eloScore.gamesWon + 1 : eloScore.gamesWon,
          gamesLost: won ? eloScore.gamesLost : eloScore.gamesLost + 1,
          totalGames: eloScore.totalGames + 1,
          currentStreak: newStreak,
          highestStreak,
          lastPlayedAt: Date.now(),
        })
        .where(
          and(
            eq(EloScores.groupId, playSession.groupId),
            eq(EloScores.userId, participant.userId)
          )
        );
    } else {
      // First match for this player in this group
      const newStreak = won ? 1 : 0;
      await db.insert(EloScores).values({
        groupId: playSession.groupId,
        userId: participant.userId,
        elo: newElo,
        gamesWon: won ? 1 : 0,
        gamesLost: won ? 0 : 1,
        totalGames: 1,
        currentStreak: newStreak,
        highestStreak: newStreak,
        lastPlayedAt: Date.now(),
      });
    }

    // Update match participant
    await db
      .update(MatchParticipants)
      .set({
        eloAfter: newElo,
        eloChange,
      })
      .where(
        and(
          eq(MatchParticipants.matchId, matchId),
          eq(MatchParticipants.userId, participant.userId)
        )
      );

    updates.push({
      userId: participant.userId,
      eloChange,
      newElo,
    });
  }

  // Update match
  await db
    .update(Matches)
    .set({
      endedAt: Date.now(),
      winningTeam,
    })
    .where(eq(Matches.id, matchId));

  // Broadcast SSE events
  sseManager.broadcastToPlaySession(playSession.playSessionId, {
    type: "match_ended",
    data: { matchId, winningTeam },
  });

  sseManager.broadcastToMatch(matchId, {
    type: "match_ended",
    data: { matchId, winningTeam, updates },
  });

  // Broadcast Elo updates to each affected user
  for (const update of updates) {
    sseManager.broadcastToUser(update.userId, {
      type: "elo_update",
      data: { matchId, eloChange: update.eloChange, newElo: update.newElo },
    });
  }

  return { success: true, updates };
}

export async function cancelMatch(formData: FormData) {
  const user = await getUser();
  const matchId = Number(formData.get("matchId"));

  if (!matchId) {
    return { success: false, error: "Match ID is required" };
  }

  const match = await db
    .select()
    .from(Matches)
    .where(eq(Matches.id, matchId))
    .get();

  if (!match) {
    return { success: false, error: "Match not found" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, match.playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.hostId !== user.id) {
    return { success: false, error: "Only the host can cancel a match" };
  }

  if (match.endedAt) {
    return { success: false, error: "Match already ended" };
  }

  await db
    .update(Matches)
    .set({
      cancelled: true,
      endedAt: Date.now(),
    })
    .where(eq(Matches.id, matchId));

  return { success: true };
}

export async function penalizePlayer(formData: FormData) {
  const user = await getUser();
  const matchId = Number(formData.get("matchId"));
  const userId = Number(formData.get("userId"));

  if (!matchId || !userId) {
    return { success: false, error: "Match ID and user ID are required" };
  }

  const match = await db
    .select()
    .from(Matches)
    .where(eq(Matches.id, matchId))
    .get();

  if (!match) {
    return { success: false, error: "Match not found" };
  }

  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, match.playSessionId))
    .get();

  if (!playSession) {
    return { success: false, error: "Play session not found" };
  }

  if (playSession.hostId !== user.id) {
    return { success: false, error: "Only the host can penalize players" };
  }

  if (match.endedAt) {
    return { success: false, error: "Match already ended" };
  }

  await db
    .update(MatchParticipants)
    .set({ penalized: true })
    .where(
      and(
        eq(MatchParticipants.matchId, matchId),
        eq(MatchParticipants.userId, userId)
      )
    );

  return { success: true };
}

export async function getMatch(matchId: number) {
  await getUser(); // Ensure authenticated

  const match = await db
    .select()
    .from(Matches)
    .where(eq(Matches.id, matchId))
    .get();

  if (!match) {
    throw new Error("Match not found");
  }

  const participants = await db
    .select({
      userId: MatchParticipants.userId,
      team: MatchParticipants.team,
      eloBefore: MatchParticipants.eloBefore,
      eloAfter: MatchParticipants.eloAfter,
      eloChange: MatchParticipants.eloChange,
      penalized: MatchParticipants.penalized,
      username: Users.username,
    })
    .from(MatchParticipants)
    .innerJoin(Users, eq(MatchParticipants.userId, Users.id))
    .where(eq(MatchParticipants.matchId, matchId))
    .all();

  const team0 = participants.filter((p) => p.team === 0);
  const team1 = participants.filter((p) => p.team === 1);

  // Get play session to check host
  const playSession = await db
    .select()
    .from(PlaySessions)
    .where(eq(PlaySessions.id, match.playSessionId))
    .get();

  const user = await getUser();

  return {
    ...match,
    team0,
    team1,
    isHost: playSession?.hostId === user.id,
  };
}

export async function getActiveMatch(playSessionId: number) {
  await getUser(); // Ensure authenticated

  const match = await db
    .select()
    .from(Matches)
    .where(
      and(
        eq(Matches.playSessionId, playSessionId),
        eq(Matches.endedAt, null),
        eq(Matches.cancelled, false)
      )
    )
    .get();

  if (!match) {
    return null;
  }

  return getMatch(match.id);
}
