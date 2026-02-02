import { createAsync, useParams, type RouteDefinition } from "@solidjs/router";
import {
  getUser,
  getLobby,
  getActiveMatch,
  inviteToLobby,
  setSpectator,
  endLobby,
  startMatch,
} from "~/api";
import { For, Show, createSignal, onMount, onCleanup } from "solid-js";
import {
  inviteToLobby as inviteToLobbyServer,
  setSpectator as setSpectatorServer,
  endLobby as endLobbyServer,
  leaveLobby as leaveLobbyServer,
} from "~/api/lobbies";
import { startMatch as startMatchServer } from "~/api/matches";
import { getGroupLeaderboard } from "~/api";

export const route = {
  preload({ params }) {
    const lobbyId = Number(params.lobbyId);
    getUser();
    getLobby(lobbyId);
    getActiveMatch(lobbyId);
  },
} satisfies RouteDefinition;

export default function LobbyPage() {
  const params = useParams();
  const lobbyId = () => Number(params.lobbyId);
  const user = createAsync(async () => getUser(), { deferStream: true });
  const lobby = createAsync(async () => getLobby(lobbyId()), {
    deferStream: true,
  });
  const activeMatch = createAsync(async () => getActiveMatch(lobbyId()), {
    deferStream: true,
  });
  const [showInviteModal, setShowInviteModal] = createSignal(false);
  const [selectedUserIds, setSelectedUserIds] = createSignal<number[]>([]);
  const [matchSize, setMatchSize] = createSignal(4);

  // Get group members for inviting
  const groupMembers = createAsync(
    async () => {
      const lobbyData = await getLobby(lobbyId());
      return getGroupLeaderboard(lobbyData.groupId);
    },
    { deferStream: true }
  );

  // SSE connection for real-time updates
  let eventSource: EventSource | null = null;

  onMount(() => {
    // Connect to SSE stream
    eventSource = new EventSource(`/api/sse/lobby/${lobbyId()}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Refresh data on updates
      if (
        data.type === "player_joined" ||
        data.type === "player_left" ||
        data.type === "match_started" ||
        data.type === "match_ended"
      ) {
        // Trigger refresh
        window.location.reload();
      }
    };

    eventSource.addEventListener("lobby_invite", (event) => {
      const data = JSON.parse(event.data);
      if (data.userId === user()?.id) {
        alert("You've been invited to this lobby!");
        window.location.reload();
      }
    });
  });

  onCleanup(() => {
    if (eventSource) {
      eventSource.close();
    }
  });

  const isHost = () => lobby()?.isHost ?? false;
  const participants = () => lobby()?.participants ?? [];
  const nonSpectators = () => participants().filter((p) => !p.isSpectator);
  const spectators = () => participants().filter((p) => p.isSpectator);

  return (
    <main class="w-full p-4 max-w-6xl mx-auto">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-3xl text-primary">Lobby #{lobbyId()}</h2>

          <Show when={isHost()}>
            <div class="badge badge-primary badge-lg">Host</div>
          </Show>

          <div class="divider"></div>

          <Show when={activeMatch()}>
            <div class="alert alert-info mb-4">
              <span>Active match in progress!</span>
              <a
                href={`/matches/${activeMatch()!.id}`}
                class="btn btn-sm btn-primary ml-4"
              >
                View Match
              </a>
            </div>
          </Show>

          <Show when={isHost() && !activeMatch()}>
            <div class="card bg-base-200 mb-4">
              <div class="card-body">
                <h3 class="card-title">Start Match</h3>
                <form
                  onsubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    formData.append("lobbyId", String(lobbyId()));
                    formData.append("matchSize", String(matchSize()));
                    const result = await startMatchServer(formData);
                    if (result?.success) {
                      window.location.href = `/matches/${result.match.id}`;
                    } else {
                      alert(result?.error || "Failed to start match");
                    }
                  }}
                >
                  <div class="form-control">
                    <label class="label">
                      <span class="label-text">Match Size (players)</span>
                    </label>
                    <input
                      type="number"
                      name="matchSize"
                      min="2"
                      max={nonSpectators().length}
                      value={matchSize()}
                      oninput={(e) =>
                        setMatchSize(Number(e.currentTarget.value))
                      }
                      class="input input-bordered"
                      required
                    />
                    <label class="label">
                      <span class="label-text">
                        Available players: {nonSpectators().length}
                      </span>
                    </label>
                  </div>
                  <div class="form-control mt-4">
                    <button
                      type="submit"
                      class="btn btn-primary"
                      disabled={nonSpectators().length < 2}
                    >
                      Start Match
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </Show>

          <div class="divider"></div>

          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-semibold">Participants</h3>
            <Show when={isHost()}>
              <button
                class="btn btn-secondary btn-sm"
                onclick={() => setShowInviteModal(true)}
              >
                Invite Players
              </button>
            </Show>
          </div>

          <Show when={showInviteModal()}>
            <div class="modal modal-open">
              <div class="modal-box">
                <h3 class="font-bold text-lg mb-4">Invite Players</h3>
                <div class="max-h-60 overflow-y-auto">
                  <For each={groupMembers()}>
                    {(member) => {
                      const isParticipant = participants().some(
                        (p) => p.userId === member.user.id
                      );
                      return (
                        <label class="label cursor-pointer">
                          <span class="label-text">
                            {member.user.username}
                            {isParticipant && (
                              <span class="badge badge-sm ml-2">Joined</span>
                            )}
                          </span>
                          <input
                            type="checkbox"
                            class="checkbox"
                            checked={selectedUserIds().includes(member.user.id)}
                            disabled={isParticipant}
                            onchange={(e) => {
                              if (e.currentTarget.checked) {
                                setSelectedUserIds([
                                  ...selectedUserIds(),
                                  member.user.id,
                                ]);
                              } else {
                                setSelectedUserIds(
                                  selectedUserIds().filter(
                                    (id) => id !== member.user.id
                                  )
                                );
                              }
                            }}
                          />
                        </label>
                      );
                    }}
                  </For>
                </div>
                <div class="modal-action">
                  <button
                    class="btn"
                    onclick={() => {
                      setShowInviteModal(false);
                      setSelectedUserIds([]);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    class="btn btn-primary"
                    onclick={async () => {
                      if (selectedUserIds().length === 0) {
                        alert("Please select at least one player");
                        return;
                      }
                      const formData = new FormData();
                      formData.append("lobbyId", String(lobbyId()));
                      formData.append("userIds", selectedUserIds().join(","));
                      const result = await inviteToLobbyServer(formData);
                      if (result?.success) {
                        setShowInviteModal(false);
                        setSelectedUserIds([]);
                        window.location.reload();
                      } else {
                        alert(result?.error || "Failed to invite players");
                      }
                    }}
                  >
                    Invite
                  </button>
                </div>
              </div>
            </div>
          </Show>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="font-semibold mb-2">Players</h4>
              <div class="space-y-2">
                <For each={nonSpectators()}>
                  {(participant) => (
                    <div class="flex justify-between items-center p-2 bg-base-200 rounded">
                      <span>{participant.username}</span>
                      <Show
                        when={isHost() && participant.userId !== user()?.id}
                      >
                        <button
                          class="btn btn-xs btn-ghost"
                          onclick={async () => {
                            const formData = new FormData();
                            formData.append("lobbyId", String(lobbyId()));
                            formData.append(
                              "userId",
                              String(participant.userId)
                            );
                            formData.append("isSpectator", "true");
                            const result = await setSpectatorServer(formData);
                            if (result?.success) {
                              window.location.reload();
                            } else {
                              alert(result?.error || "Failed to set spectator");
                            }
                          }}
                        >
                          Make Spectator
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <div>
              <h4 class="font-semibold mb-2">Spectators</h4>
              <div class="space-y-2">
                <For each={spectators()}>
                  {(participant) => (
                    <div class="flex justify-between items-center p-2 bg-base-200 rounded">
                      <span>{participant.username}</span>
                      <Show when={isHost()}>
                        <button
                          class="btn btn-xs btn-ghost"
                          onclick={async () => {
                            const formData = new FormData();
                            formData.append("lobbyId", String(lobbyId()));
                            formData.append(
                              "userId",
                              String(participant.userId)
                            );
                            formData.append("isSpectator", "false");
                            const result = await setSpectatorServer(formData);
                            if (result?.success) {
                              window.location.reload();
                            } else {
                              alert(
                                result?.error || "Failed to remove spectator"
                              );
                            }
                          }}
                        >
                          Make Player
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <Show when={isHost()}>
            <div class="card-actions justify-end">
              <button
                class="btn btn-error"
                onclick={async () => {
                  if (!confirm("Are you sure you want to end this lobby?")) {
                    return;
                  }
                  const formData = new FormData();
                  formData.append("lobbyId", String(lobbyId()));
                  const result = await endLobbyServer(formData);
                  if (result?.success) {
                    window.location.href = `/groups/${lobby()?.groupId}`;
                  } else {
                    alert(result?.error || "Failed to end lobby");
                  }
                }}
              >
                End Lobby
              </button>
            </div>
          </Show>

          <Show when={!isHost()}>
            <div class="card-actions justify-end">
              <button
                class="btn btn-error btn-outline"
                onclick={async () => {
                  if (!confirm("Are you sure you want to leave this lobby?")) {
                    return;
                  }
                  const formData = new FormData();
                  formData.append("lobbyId", String(lobbyId()));
                  const result = await leaveLobbyServer(formData);
                  if (result?.success) {
                    window.location.href = `/groups/${lobby()?.groupId}`;
                  } else {
                    alert(result?.error || "Failed to leave lobby");
                  }
                }}
              >
                Leave Lobby
              </button>
            </div>
          </Show>
        </div>
      </div>
    </main>
  );
}
