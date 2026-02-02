#!/usr/bin/env bun

import { startMatchAsHost } from "./test-helpers";

const playSessionId = Number(process.argv[2]);
const matchSize = Number(process.argv[3]);

if (!playSessionId || !matchSize || isNaN(playSessionId) || isNaN(matchSize)) {
  console.error(
    "Usage: bun run scripts/start-match.ts <playSessionId> <matchSize>"
  );
  console.error("  playSessionId: Required - ID of the play session");
  console.error("  matchSize: Required - Number of players (must be even)");
  process.exit(1);
}

if (matchSize % 2 !== 0) {
  console.error("Error: Match size must be even for 2 teams");
  process.exit(1);
}

try {
  const result = await startMatchAsHost(playSessionId, matchSize);
  console.log(
    JSON.stringify(
      {
        matchId: result.matchId,
        team1: result.teamAssignment.team1.map((p) => ({
          userId: p.userId,
          elo: p.elo,
        })),
        team2: result.teamAssignment.team2.map((p) => ({
          userId: p.userId,
          elo: p.elo,
        })),
        eloDiff: result.teamAssignment.eloDiff.toFixed(2),
      },
      null,
      2
    )
  );
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
