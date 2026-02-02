const STARTING_ELO = 1500;
const K_FACTOR = 40;
const STREAK_BONUS_PER_WIN = 0.04; // 4% per win
const MAX_STREAK_BONUS_WINS = 3; // Max 3 wins for bonus

export interface Player {
  userId: number;
  elo: number;
  gamesPlayed?: number;
}

export interface TeamAssignment {
  team1: Player[];
  team2: Player[];
  eloDiff: number;
}

/**
 * Calculate Elo change for a player
 */
export function calculateEloChange(
  playerElo: number,
  opponentTeamAvgElo: number,
  won: boolean,
  streakBonus: number = 0
): number {
  const expectedScore =
    1 / (1 + Math.pow(10, (opponentTeamAvgElo - playerElo) / 400));
  const actualScore = won ? 1 : 0;
  const kAdjusted = K_FACTOR * (1 + streakBonus);
  const eloChange = Math.round(kAdjusted * (actualScore - expectedScore));
  return eloChange;
}

/**
 * Calculate streak bonus multiplier (0 to 0.12 for 0 to 3 wins)
 */
export function calculateStreakBonus(currentStreak: number): number {
  const winsForBonus = Math.min(currentStreak, MAX_STREAK_BONUS_WINS);
  return winsForBonus * STREAK_BONUS_PER_WIN;
}

/**
 * Calculate average Elo for a team
 */
function calculateTeamAvgElo(team: Player[]): number {
  if (team.length === 0) return 0;
  const sum = team.reduce((acc, p) => acc + p.elo, 0);
  return sum / team.length;
}

/**
 * Generate all possible team combinations
 */
function generateTeamCombinations(
  players: Player[],
  teamSize: number
): TeamAssignment[] {
  const combinations: TeamAssignment[] = [];
  const n = players.length;
  const halfSize = teamSize / 2;

  // Generate combinations using bit manipulation
  const maxCombinations = Math.pow(2, n);
  for (let i = 0; i < maxCombinations; i++) {
    const team1: Player[] = [];
    const team2: Player[] = [];

    for (let j = 0; j < n; j++) {
      if ((i >> j) & 1) {
        team1.push(players[j]);
      } else {
        team2.push(players[j]);
      }
    }

    if (team1.length === halfSize && team2.length === halfSize) {
      const team1Avg = calculateTeamAvgElo(team1);
      const team2Avg = calculateTeamAvgElo(team2);
      const eloDiff = Math.abs(team1Avg - team2Avg);

      combinations.push({
        team1,
        team2,
        eloDiff,
      });
    }
  }

  return combinations;
}

/**
 * Balance teams based on Elo scores
 * Returns the team assignment with the smallest Elo difference
 */
export function balanceTeams(
  players: Player[],
  matchSize: number
): TeamAssignment {
  if (players.length !== matchSize) {
    throw new Error(
      `Player count (${players.length}) must match match size (${matchSize})`
    );
  }

  if (matchSize % 2 !== 0) {
    throw new Error("Match size must be even for 2 teams");
  }

  // Use 1500 for players without Elo
  const playersWithElo = players.map((p) => ({
    ...p,
    elo: p.elo || STARTING_ELO,
  }));

  // Generate all possible team combinations
  const combinations = generateTeamCombinations(playersWithElo, matchSize);

  if (combinations.length === 0) {
    // Fallback: split in half
    const half = matchSize / 2;
    return {
      team1: playersWithElo.slice(0, half),
      team2: playersWithElo.slice(half),
      eloDiff: Math.abs(
        calculateTeamAvgElo(playersWithElo.slice(0, half)) -
          calculateTeamAvgElo(playersWithElo.slice(half))
      ),
    };
  }

  // Find combination with smallest Elo difference
  let best = combinations[0];
  for (const combo of combinations) {
    if (combo.eloDiff < best.eloDiff) {
      best = combo;
    }
  }

  return best;
}

/**
 * Select players for a match ensuring similar gametime
 * Prioritizes players with fewer games played in the lobby
 */
export function selectPlayersForMatch(
  participants: Array<{
    userId: number;
    elo: number;
    isSpectator: boolean;
    gamesPlayed: number;
  }>,
  matchSize: number
): Player[] {
  // Filter out spectators
  const eligiblePlayers = participants
    .filter((p) => !p.isSpectator)
    .map((p) => ({
      userId: p.userId,
      elo: p.elo || STARTING_ELO,
      gamesPlayed: p.gamesPlayed || 0,
    }));

  if (eligiblePlayers.length < matchSize) {
    throw new Error(
      `Not enough eligible players (${eligiblePlayers.length}) for match size (${matchSize})`
    );
  }

  // Sort by games played (ascending) to prioritize players with less gametime
  eligiblePlayers.sort((a, b) => a.gamesPlayed - b.gamesPlayed);

  // Select players ensuring fair distribution
  // Take players with least games first, then randomly from similar game counts
  const selected: Player[] = [];
  const selectedIds = new Set<number>();

  // First, take players with the minimum games played
  const minGames = eligiblePlayers[0].gamesPlayed;
  const minGamesPlayers = eligiblePlayers.filter(
    (p) => p.gamesPlayed === minGames
  );

  // Shuffle for randomness
  const shuffled = [...minGamesPlayers].sort(() => Math.random() - 0.5);

  for (const player of shuffled) {
    if (selected.length < matchSize && !selectedIds.has(player.userId)) {
      selected.push({ userId: player.userId, elo: player.elo });
      selectedIds.add(player.userId);
    }
  }

  // If we still need more players, take from next tier
  if (selected.length < matchSize) {
    const remaining = eligiblePlayers.filter((p) => !selectedIds.has(p.userId));
    remaining.sort(() => Math.random() - 0.5);

    for (const player of remaining) {
      if (selected.length < matchSize) {
        selected.push({ userId: player.userId, elo: player.elo });
        selectedIds.add(player.userId);
      }
    }
  }

  return selected.slice(0, matchSize);
}
