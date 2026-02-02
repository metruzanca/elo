import { Command } from "commander";
import { createTestUser, listUsers } from "../lib/helpers";

export function registerUserCommands(parent: Command): Command {
  const userCmd = parent
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

  return userCmd;
}
