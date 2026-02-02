import { createAsync, useParams, type RouteDefinition } from "@solidjs/router";
import {
  getUser,
  getGroup,
  getGroupLeaderboard,
  getActivePlaySessions,
  createPlaySession,
  leaveGroup,
  regenerateInviteCode,
} from "~/api";
import { For, Show, createSignal } from "solid-js";
import { createPlaySession as createPlaySessionServer } from "~/api/play-sessions";
import { leaveGroup as leaveGroupServer } from "~/api/groups";

export const route = {
  preload({ params }) {
    const groupId = Number(params.groupId);
    getUser();
    getGroup(groupId);
    getGroupLeaderboard(groupId);
    getActivePlaySessions(groupId);
  },
} satisfies RouteDefinition;

export default function GroupPage() {
  const params = useParams();
  const groupId = () => Number(params.groupId);
  const user = createAsync(async () => getUser(), { deferStream: true });
  const group = createAsync(async () => getGroup(groupId()), {
    deferStream: true,
  });
  const leaderboard = createAsync(async () => getGroupLeaderboard(groupId()), {
    deferStream: true,
  });
  const playSessions = createAsync(
    async () => getActivePlaySessions(groupId()),
    { deferStream: true }
  );
  const [showCreateSession, setShowCreateSession] = createSignal(false);

  // Find active session where user is host
  const hostActiveSession = () => {
    const sessions = playSessions();
    const currentUser = user();
    if (!sessions || !currentUser) return null;
    return (
      sessions.find((session) => session.hostId === currentUser.id) || null
    );
  };

  return (
    <main class="w-full p-4 max-w-6xl mx-auto">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center">
            <h2 class="card-title text-3xl text-primary">
              {group()?.name || `Group ${groupId()}`}
            </h2>
            <div class="dropdown dropdown-end">
              <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="w-6 h-6"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z"
                  />
                </svg>
              </div>
              <ul
                tabindex="0"
                class="menu dropdown-content bg-base-100 border-2 border-base-300 rounded-box z-10 w-52 p-2 shadow-lg"
              >
                <li>
                  <button
                    class="text-error"
                    onclick={async () => {
                      if (
                        !confirm(
                          "Are you sure you want to leave this group? Your match history and Elo will be deleted."
                        )
                      ) {
                        return;
                      }
                      const formData = new FormData();
                      formData.append("groupId", String(groupId()));
                      const result = await leaveGroupServer(formData);
                      if (result?.success) {
                        window.location.href = "/";
                      } else {
                        alert(result?.error || "Failed to leave group");
                      }
                    }}
                  >
                    Leave Group
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="divider"></div>

          <div class="flex gap-4 flex-wrap mb-4">
            <Show
              when={hostActiveSession()}
              fallback={
                <button
                  class="btn btn-primary"
                  onclick={() => setShowCreateSession(true)}
                >
                  Create Play Session
                </button>
              }
            >
              <a
                href={`/play-sessions/${hostActiveSession()!.id}`}
                class="btn btn-primary"
              >
                Go to Active Session
              </a>
            </Show>
            <a href={`/groups/${groupId()}/history`} class="btn btn-secondary">
              View Match History
            </a>
          </div>

          <Show when={showCreateSession()}>
            <div class="card bg-base-200 mt-4">
              <div class="card-body">
                <h3 class="card-title">Create Play Session</h3>
                <form
                  onsubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    formData.append("groupId", String(groupId()));
                    const result = await createPlaySessionServer(formData);
                    if (result?.success) {
                      setShowCreateSession(false);
                      window.location.href = `/play-sessions/${result.playSession.id}`;
                    } else {
                      alert(result?.error || "Failed to create play session");
                    }
                  }}
                >
                  <div class="form-control mt-4">
                    <button type="submit" class="btn btn-primary">
                      Create Session
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Show>

          <div class="divider"></div>

          <h3 class="text-xl font-semibold mb-4">Leaderboard</h3>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Elo</th>
                  <th>Wins</th>
                  <th>Losses</th>
                  <th>Ties</th>
                  <th>Win %</th>
                  <th>Total Games</th>
                  <th>Current Streak</th>
                  <th>Highest Streak</th>
                </tr>
              </thead>
              <tbody>
                <For each={leaderboard()}>
                  {(player, index) => (
                    <tr>
                      <td>{index() + 1}</td>
                      <td class="font-semibold">{player.user.username}</td>
                      <td>{player.elo}</td>
                      <td>{player.gamesWon}</td>
                      <td>{player.gamesLost}</td>
                      <td>{player.gamesTied}</td>
                      <td>{player.winPercentage}%</td>
                      <td>{player.totalGames}</td>
                      <td>
                        <span
                          class={`badge ${
                            player.currentStreak > 0
                              ? "badge-success"
                              : player.currentStreak < 0
                              ? "badge-error"
                              : ""
                          }`}
                        >
                          {player.currentStreak > 0 ? "+" : ""}
                          {player.currentStreak}
                        </span>
                      </td>
                      <td>{player.highestStreak}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>

          <div class="divider"></div>

          <h3 class="text-xl font-semibold mb-4">Active Play Sessions</h3>
          <Show
            when={playSessions() && playSessions()!.length > 0}
            fallback={
              <p class="text-base-content/70">
                No active play sessions. Create one to get started!
              </p>
            }
          >
            <div class="grid gap-4">
              <For each={playSessions()}>
                {(session) => (
                  <div class="card bg-base-200">
                    <div class="card-body">
                      <h4 class="card-title">Play Session #{session.id}</h4>
                      <p class="text-sm text-base-content/70">
                        Started: {new Date(session.createdAt).toLocaleString()}
                      </p>
                      <div class="card-actions justify-end">
                        <a
                          href={`/play-sessions/${session.id}`}
                          class="btn btn-primary btn-sm"
                        >
                          Join Session
                        </a>
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
