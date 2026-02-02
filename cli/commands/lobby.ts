import { Command } from "commander";
import {
  createLobbyAsUser,
  inviteUserToLobby,
  joinLobbyAsUser,
  listLobbies,
} from "../lib/helpers";

export function registerLobbyCommands(parent: Command): Command {
  const lobbyCmd = parent
    .command("lobby")
    .description("Lobby management commands")
    .action(() => {
      lobbyCmd.outputHelp();
      process.exit(0);
    });

  lobbyCmd
    .command("list")
    .alias("ls")
    .description("List all lobbies")
    .option("-j, --json", "Output as JSON")
    .option("-a, --active-only", "Show only active lobbies")
    .action(async (options: { json?: boolean; activeOnly?: boolean }) => {
      try {
        let lobbies = await listLobbies();
        if (options.activeOnly) {
          lobbies = lobbies.filter((l) => l.status === "active");
        }
        if (options.json) {
          console.log(JSON.stringify(lobbies, null, 2));
        } else {
          if (lobbies.length === 0) {
            console.log(
              options.activeOnly
                ? "No active lobbies found."
                : "No lobbies found."
            );
          } else {
            console.log(`Found ${lobbies.length} lobby(s):\n`);
            for (const lobby of lobbies) {
              console.log(`ID: ${lobby.id}`);
              console.log(`  Group ID: ${lobby.groupId}`);
              console.log(
                `  Host: ${lobby.hostUsername} (ID: ${lobby.hostId})`
              );
              console.log(`  Status: ${lobby.status}`);
              console.log(`  Participants: ${lobby.participantCount}`);
              console.log(
                `  Created: ${new Date(lobby.createdAt).toLocaleString()}`
              );
              if (lobby.endedAt) {
                console.log(
                  `  Ended: ${new Date(lobby.endedAt).toLocaleString()}`
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

  lobbyCmd
    .command("create")
    .description("Create a lobby with user as host")
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
        const lobby = await createLobbyAsUser(userId, groupId);
        console.log(
          JSON.stringify({
            id: lobby.id,
            groupId: lobby.groupId,
            hostId: lobby.hostId,
          })
        );
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  lobbyCmd
    .command("join")
    .alias("accept-invite")
    .description("Join a lobby (accept invite)")
    .argument("<userId>", "ID of the user joining the lobby")
    .argument("<lobbyId>", "ID of the lobby")
    .action(async (userIdStr: string, lobbyIdStr: string) => {
      const userId = Number(userIdStr);
      const lobbyId = Number(lobbyIdStr);

      if (isNaN(userId) || isNaN(lobbyId)) {
        console.error("Error: userId and lobbyId must be valid numbers");
        process.exit(1);
      }

      try {
        await joinLobbyAsUser(userId, lobbyId);
        console.log(`User ${userId} successfully joined lobby ${lobbyId}`);
      } catch (error) {
        console.error(
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });

  lobbyCmd
    .command("invite")
    .description("Invite one or more users to a lobby")
    .argument("<lobbyId>", "ID of the lobby")
    .argument("<userIds...>", "One or more user IDs to invite")
    .action(async (lobbyIdStr: string, userIdsStr: string[]) => {
      const lobbyId = Number(lobbyIdStr);
      const userIds = userIdsStr.map((id) => Number(id));

      if (isNaN(lobbyId)) {
        console.error("Error: lobbyId must be a valid number");
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
          await inviteUserToLobby(lobbyId, userId);
          console.log(
            `User ${userId} successfully invited to lobby ${lobbyId}`
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

  return lobbyCmd;
}
