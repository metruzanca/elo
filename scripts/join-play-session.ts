#!/usr/bin/env bun

import { joinPlaySessionAsUser } from "./test-helpers";

const userId = Number(process.argv[2]);
const playSessionId = Number(process.argv[3]);

if (!userId || !playSessionId || isNaN(userId) || isNaN(playSessionId)) {
  console.error(
    "Usage: bun run scripts/join-play-session.ts <userId> <playSessionId>"
  );
  console.error("  userId: Required - ID of the user joining the session");
  console.error("  playSessionId: Required - ID of the play session to join");
  process.exit(1);
}

try {
  await joinPlaySessionAsUser(userId, playSessionId);
  console.log(
    `User ${userId} successfully joined play session ${playSessionId}`
  );
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
