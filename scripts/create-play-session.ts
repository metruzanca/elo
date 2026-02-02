#!/usr/bin/env bun

import { createPlaySessionAsUser } from "./test-helpers";

const userId = Number(process.argv[2]);
const groupId = Number(process.argv[3]);

if (!userId || !groupId || isNaN(userId) || isNaN(groupId)) {
  console.error(
    "Usage: bun run scripts/create-play-session.ts <userId> <groupId>"
  );
  console.error(
    "  userId: Required - ID of the user creating the session (will be host)"
  );
  console.error("  groupId: Required - ID of the group to create session in");
  process.exit(1);
}

try {
  const playSession = await createPlaySessionAsUser(userId, groupId);
  console.log(
    JSON.stringify({
      id: playSession.id,
      groupId: playSession.groupId,
      hostId: playSession.hostId,
    })
  );
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
