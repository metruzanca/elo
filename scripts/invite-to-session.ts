#!/usr/bin/env bun

import { inviteUserToSession } from "./test-helpers";

const playSessionId = Number(process.argv[2]);
const userIds = process.argv.slice(3).map((id) => Number(id));

if (!playSessionId || isNaN(playSessionId) || userIds.length === 0) {
  console.error(
    "Usage: bun run scripts/invite-to-session.ts <playSessionId> <userId1> [userId2] ..."
  );
  console.error("  playSessionId: Required - ID of the play session");
  console.error(
    "  userId1, userId2, ...: Required - One or more user IDs to invite"
  );
  process.exit(1);
}

// Validate all user IDs are numbers
if (userIds.some((id) => isNaN(id))) {
  console.error("Error: All user IDs must be valid numbers");
  process.exit(1);
}

try {
  for (const userId of userIds) {
    await inviteUserToSession(playSessionId, userId);
    console.log(
      `User ${userId} successfully invited to play session ${playSessionId}`
    );
  }
  console.log(`All ${userIds.length} user(s) successfully invited`);
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
