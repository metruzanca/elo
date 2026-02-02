#!/usr/bin/env bun

import { program } from "commander";
import {
  createTestUser,
  joinGroupAsUser,
  createPlaySessionAsUser,
  inviteUserToSession,
  joinPlaySessionAsUser,
  startMatchAsHost,
  listUsers,
  listGroups,
  listPlaySessions,
} from "../scripts/test-helpers";

program
  .name("elo-cli")
  .description("CLI tool for testing Elo app operations")
  .version("1.0.0");

// User commands
const userCmd = program
  .command("user")
  .description("User management commands")
  .action(() => {
    userCmd.outputHelp();
    process.exit(0);
  });

userCmd
  .command("create")
  .description("Create a test user")
  .argument("<username>", "Username for the new user")
  .option(
    "-p, --password <password>",
    "Password (default: 'test123')",
    "test123"
  )
  .action(async (username: string, options: { password: string }) => {
    try {
      const user = await createTestUser(username, options.password);
      console.log(JSON.stringify({ id: user.id, username: user.username }));
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

userCmd
  .command("list")
  .alias("ls")
  .description("List all users")
  .option("-j, --json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const users = await listUsers();
      if (options.json) {
        console.log(JSON.stringify(users, null, 2));
      } else {
        if (users.length === 0) {
          console.log("No users found.");
        } else {
          console.log(`Found ${users.length} user(s):\n`);
          console.log("ID\tUsername");
          console.log("--\t--------");
          for (const user of users) {
            console.log(`${user.id}\t${user.username}`);
          }
        }
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

// Group commands
const groupCmd = program
  .command("group")
  .description("Group management commands")
  .action(() => {
    groupCmd.outputHelp();
    process.exit(0);
  });

groupCmd
  .command("list")
  .alias("ls")
  .description("List all groups")
  .option("-j, --json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const groups = await listGroups();
      if (options.json) {
        console.log(JSON.stringify(groups, null, 2));
      } else {
        if (groups.length === 0) {
          console.log("No groups found.");
        } else {
          console.log(`Found ${groups.length} group(s):\n`);
          for (const group of groups) {
            console.log(`ID: ${group.id}`);
            console.log(`  Name: ${group.name || `Group ${group.id}`}`);
            console.log(`  Invite Code: ${group.inviteCode}`);
            console.log(
              `  Creator: ${group.creatorUsername} (ID: ${group.createdBy})`
            );
            console.log(`  Members: ${group.memberCount}`);
            console.log(
              `  Created: ${new Date(group.createdAt).toLocaleString()}`
            );
            console.log("");
          }
        }
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

groupCmd
  .command("join")
  .description("Join a group as a user")
  .argument("<userId>", "ID of the user")
  .argument("<groupId>", "ID of the group")
  .action(async (userIdStr: string, groupIdStr: string) => {
    const userId = Number(userIdStr);
    const groupId = Number(groupIdStr);

    if (isNaN(userId) || isNaN(groupId)) {
      console.error("Error: userId and groupId must be valid numbers");
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
  });

// Session commands
const sessionCmd = program
  .command("session")
  .description("Play session management commands")
  .action(() => {
    sessionCmd.outputHelp();
    process.exit(0);
  });

sessionCmd
  .command("list")
  .alias("ls")
  .description("List all play sessions")
  .option("-j, --json", "Output as JSON")
  .option("-a, --active-only", "Show only active sessions")
  .action(async (options: { json?: boolean; activeOnly?: boolean }) => {
    try {
      let sessions = await listPlaySessions();
      if (options.activeOnly) {
        sessions = sessions.filter((s) => s.status === "active");
      }
      if (options.json) {
        console.log(JSON.stringify(sessions, null, 2));
      } else {
        if (sessions.length === 0) {
          console.log(
            options.activeOnly
              ? "No active play sessions found."
              : "No play sessions found."
          );
        } else {
          console.log(`Found ${sessions.length} play session(s):\n`);
          for (const session of sessions) {
            console.log(`ID: ${session.id}`);
            console.log(`  Group ID: ${session.groupId}`);
            console.log(
              `  Host: ${session.hostUsername} (ID: ${session.hostId})`
            );
            console.log(`  Status: ${session.status}`);
            console.log(`  Participants: ${session.participantCount}`);
            console.log(
              `  Created: ${new Date(session.createdAt).toLocaleString()}`
            );
            if (session.endedAt) {
              console.log(
                `  Ended: ${new Date(session.endedAt).toLocaleString()}`
              );
            }
            console.log("");
          }
        }
      }
    } catch (error) {
      console.error(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  });

sessionCmd
  .command("create")
  .description("Create a play session with user as host")
  .argument("<userId>", "ID of the user (will be host)")
  .argument("<groupId>", "ID of the group")
  .action(async (userIdStr: string, groupIdStr: string) => {
    const userId = Number(userIdStr);
    const groupId = Number(groupIdStr);

    if (isNaN(userId) || isNaN(groupId)) {
      console.error("Error: userId and groupId must be valid numbers");
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
  });

sessionCmd
  .command("join")
  .alias("accept-invite")
  .description("Join a play session (accept invite)")
  .argument("<userId>", "ID of the user joining the session")
  .argument("<playSessionId>", "ID of the play session")
  .action(async (userIdStr: string, playSessionIdStr: string) => {
    const userId = Number(userIdStr);
    const playSessionId = Number(playSessionIdStr);

    if (isNaN(userId) || isNaN(playSessionId)) {
      console.error("Error: userId and playSessionId must be valid numbers");
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
  });

sessionCmd
  .command("invite")
  .description("Invite one or more users to a play session")
  .argument("<playSessionId>", "ID of the play session")
  .argument("<userIds...>", "One or more user IDs to invite")
  .action(async (playSessionIdStr: string, userIdsStr: string[]) => {
    const playSessionId = Number(playSessionIdStr);
    const userIds = userIdsStr.map((id) => Number(id));

    if (isNaN(playSessionId)) {
      console.error("Error: playSessionId must be a valid number");
      process.exit(1);
    }

    if (userIds.length === 0) {
      console.error("Error: At least one userId is required");
      process.exit(1);
    }

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
  });

// Match commands
const matchCmd = program
  .command("match")
  .description("Match management commands")
  .action(() => {
    matchCmd.outputHelp();
    process.exit(0);
  });

matchCmd
  .command("start")
  .description("Start a match in a play session")
  .argument("<playSessionId>", "ID of the play session")
  .argument("<matchSize>", "Number of players (must be even)")
  .action(async (playSessionIdStr: string, matchSizeStr: string) => {
    const playSessionId = Number(playSessionIdStr);
    const matchSize = Number(matchSizeStr);

    if (isNaN(playSessionId) || isNaN(matchSize)) {
      console.error("Error: playSessionId and matchSize must be valid numbers");
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
            eloDiff: Number(result.teamAssignment.eloDiff.toFixed(2)),
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
  });

// Show help if no command provided (exit code 0)
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse();
