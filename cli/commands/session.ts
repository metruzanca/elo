import { Command } from "commander";
import {
  createPlaySessionAsUser,
  inviteUserToSession,
  joinPlaySessionAsUser,
  listPlaySessions,
} from "../lib/helpers";

export function registerSessionCommands(parent: Command): Command {
  const sessionCmd = parent
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

  return sessionCmd;
}
