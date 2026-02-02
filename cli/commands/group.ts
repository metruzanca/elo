import { Command } from "commander";
import { joinGroupAsUser, listGroups } from "../lib/helpers";

export function registerGroupCommands(parent: Command): Command {
  const groupCmd = parent
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

  return groupCmd;
}
