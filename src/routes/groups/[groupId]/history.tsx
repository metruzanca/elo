import { createAsync, useParams, type RouteDefinition } from "@solidjs/router";
import { getUser, getGroup, getGroupMatchHistory } from "~/api";
import { For, Show } from "solid-js";

export const route = {
  preload({ params }) {
    const groupId = Number(params.groupId);
    getUser();
    getGroup(groupId);
    getGroupMatchHistory(groupId);
  },
} satisfies RouteDefinition;

export default function MatchHistory() {
  const params = useParams();
  const groupId = () => Number(params.groupId);
  const user = createAsync(async () => getUser(), { deferStream: true });
  const group = createAsync(async () => getGroup(groupId()), {
    deferStream: true,
  });
  const matchHistory = createAsync(
    async () => getGroupMatchHistory(groupId()),
    { deferStream: true }
  );

  return (
    <main class="w-full p-4 max-w-6xl mx-auto">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-3xl text-primary">
            Match History - {group()?.name || `Group ${groupId()}`}
          </h2>

          <div class="divider"></div>

          <Show
            when={matchHistory() && matchHistory()!.length > 0}
            fallback={<p class="text-base-content/70">No match history yet.</p>}
          >
            <div class="space-y-6">
              <For each={matchHistory()}>
                {(match) => (
                  <div class="card bg-base-200">
                    <div class="card-body">
                      <div class="flex justify-between items-start mb-4">
                        <h3 class="card-title">
                          Match #{match.id} -{" "}
                          {new Date(match.startedAt).toLocaleString()}
                        </h3>
                        <Show
                          when={match.endedAt && match.winningTeam !== null}
                        >
                          <span
                            class={`badge ${
                              match.winningTeam === 0
                                ? "badge-success"
                                : "badge-error"
                            }`}
                          >
                            Team {match.winningTeam === 0 ? "1" : "2"} Won
                          </span>
                        </Show>
                        <Show when={match.cancelled}>
                          <span class="badge badge-warning">Cancelled</span>
                        </Show>
                      </div>

                      <div class="grid grid-cols-2 gap-4">
                        <div>
                          <h4 class="font-semibold mb-2">Team 1</h4>
                          <For each={match.team0}>
                            {(player) => (
                              <div class="flex justify-between items-center py-1">
                                <span>{player.username}</span>
                                <Show
                                  when={
                                    match.endedAt && player.eloChange !== null
                                  }
                                >
                                  <span
                                    class={`text-sm ${
                                      player.eloChange! > 0
                                        ? "text-success"
                                        : player.eloChange! < 0
                                        ? "text-error"
                                        : ""
                                    }`}
                                  >
                                    {player.eloChange! > 0 ? "+" : ""}
                                    {player.eloChange} ({player.eloBefore} →{" "}
                                    {player.eloAfter})
                                  </span>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                        <div>
                          <h4 class="font-semibold mb-2">Team 2</h4>
                          <For each={match.team1}>
                            {(player) => (
                              <div class="flex justify-between items-center py-1">
                                <span>{player.username}</span>
                                <Show
                                  when={
                                    match.endedAt && player.eloChange !== null
                                  }
                                >
                                  <span
                                    class={`text-sm ${
                                      player.eloChange! > 0
                                        ? "text-success"
                                        : player.eloChange! < 0
                                        ? "text-error"
                                        : ""
                                    }`}
                                  >
                                    {player.eloChange! > 0 ? "+" : ""}
                                    {player.eloChange} ({player.eloBefore} →{" "}
                                    {player.eloAfter})
                                  </span>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </main>
  );
}
