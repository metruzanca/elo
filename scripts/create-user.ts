#!/usr/bin/env bun

import { createTestUser } from "./test-helpers";

const username = process.argv[2];
const password = process.argv[3] || "test123";

if (!username) {
  console.error("Usage: bun run scripts/create-user.ts <username> [password]");
  console.error("  username: Required - username for the new user");
  console.error("  password: Optional - password (default: 'test123')");
  process.exit(1);
}

try {
  const user = await createTestUser(username, password);
  console.log(JSON.stringify({ id: user.id, username: user.username }));
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}
