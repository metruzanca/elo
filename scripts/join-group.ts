#!/usr/bin/env bun

import { joinGroupAsUser } from "./test-helpers";

const userId = Number(process.argv[2]);
const groupId = Number(process.argv[3]);

if (!userId || !groupId || isNaN(userId) || isNaN(groupId)) {
  console.error("Usage: bun run scripts/join-group.ts <userId> <groupId>");
  console.error("  userId: Required - ID of the user to add to the group");
  console.error("  groupId: Required - ID of the group to join");
  process.exit(1);
}

try {
  await joinGroupAsUser(userId, groupId);
  console.log(`User ${userId} successfully joined group ${groupId}`);
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
