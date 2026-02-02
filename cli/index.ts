#!/usr/bin/env bun

import { program } from "commander";
import { registerUserCommands } from "./commands/user";
import { registerGroupCommands } from "./commands/group";
import { registerSessionCommands } from "./commands/session";
import { registerMatchCommands } from "./commands/match";

program
  .name("elo-cli")
  .description("CLI tool for testing Elo app operations")
  .version("1.0.0");

// Register all command groups
registerUserCommands(program);
registerGroupCommands(program);
registerSessionCommands(program);
registerMatchCommands(program);

// Show help if no command provided (exit code 0)
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse();
