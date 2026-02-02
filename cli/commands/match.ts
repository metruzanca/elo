import { Command } from "commander";
import { startMatchAsHost } from "../lib/helpers";

export function registerMatchCommands(parent: Command): Command {
  const matchCmd = parent
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
        console.error(
          "Error: playSessionId and matchSize must be valid numbers"
        );
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

  return matchCmd;
}
