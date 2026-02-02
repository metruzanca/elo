import { createAsync, useParams, type RouteDefinition } from "@solidjs/router";
import { getUser, getMatch, endMatch } from "~/api";
import {
  For,
  Show,
  createSignal,
  onMount,
  onCleanup,
  createEffect,
} from "solid-js";
import { endMatch as endMatchServer } from "~/api/matches";
// Simple spring-like easing function
function springEase(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export const route = {
  preload({ params }) {
    const matchId = Number(params.matchId);
    getUser();
    getMatch(matchId);
  },
} satisfies RouteDefinition;

export default function MatchPage() {
  const params = useParams();
  const matchId = () => Number(params.matchId);
  const user = createAsync(async () => getUser(), { deferStream: true });
  const match = createAsync(async () => getMatch(matchId()), {
    deferStream: true,
  });
  const [showEndMatchModal, setShowEndMatchModal] = createSignal(false);
  const [selectedWinningTeam, setSelectedWinningTeam] = createSignal<
    0 | 1 | null
  >(null);
  const [elapsedTime, setElapsedTime] = createSignal(0);
  const [eloAnimations, setEloAnimations] = createSignal<
    Record<number, { from: number; to: number; change: number }>
  >({});

  // Calculate elapsed time
  createEffect(() => {
    const m = match();
    if (!m || m.endedAt) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - m.startedAt) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  });

  // SSE connection for match updates
  let eventSource: EventSource | null = null;

  onMount(() => {
    const m = match();
    if (!m || m.endedAt) return;

    // Connect to SSE stream
    eventSource = new EventSource(`/api/sse/match/${matchId()}`);

    eventSource.addEventListener("match_ended", (event) => {
      const data = JSON.parse(event.data);
      // Refresh to show final results
      window.location.reload();
    });

    eventSource.addEventListener("elo_update", (event) => {
      const data = JSON.parse(event.data);
      if (data.userId === user()?.id) {
        // Trigger Elo animation
        const m = match();
        if (m) {
          const participant = [...(m.team0 || []), ...(m.team1 || [])].find(
            (p) => p.userId === user()?.id
          );
          if (participant && participant.eloBefore !== null) {
            setEloAnimations({
              ...eloAnimations(),
              [user()!.id]: {
                from: participant.eloBefore,
                to: data.newElo,
                change: data.eloChange,
              },
            });
          }
        }
      }
    });
  });

  onCleanup(() => {
    if (eventSource) {
      eventSource.close();
    }
  });

  // Animate Elo changes
  createEffect(() => {
    const animations = eloAnimations();
    Object.entries(animations).forEach(([userId, anim]) => {
      const el = document.getElementById(`elo-${userId}`);
      if (el) {
        // Animate a numeric value and update text content using easing
        const startValue = anim.from;
        const endValue = anim.to;
        const duration = 1000; // 1 second in milliseconds

        let startTime: number | null = null;
        const animateFrame = (currentTime: number) => {
          if (startTime === null) {
            startTime = currentTime;
          }

          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = springEase(progress);
          const currentValue = Math.round(
            startValue + (endValue - startValue) * easedProgress
          );

          el.textContent = String(currentValue);

          if (progress < 1) {
            requestAnimationFrame(animateFrame);
          }
        };

        requestAnimationFrame(animateFrame);
      }
    });
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const isHost = () => match()?.isHost ?? false;

  const userTeam = () => {
    const m = match();
    if (!m) return null;
    const participant = [...(m.team0 || []), ...(m.team1 || [])].find(
      (p) => p.userId === user()?.id
    );
    return participant?.team ?? null;
  };

  const team0Elo = () => {
    const m = match();
    if (!m?.team0) return 0;
    return m.team0.reduce((sum, p) => sum + (p.eloBefore || 1500), 0);
  };

  const team1Elo = () => {
    const m = match();
    if (!m?.team1) return 0;
    return m.team1.reduce((sum, p) => sum + (p.eloBefore || 1500), 0);
  };

  return (
    <main class="w-full p-4 max-w-6xl mx-auto">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex justify-between items-center">
            <h2 class="card-title text-3xl text-primary">Match #{matchId()}</h2>
            <a href="/" class="btn btn-ghost btn-sm">
              Back
            </a>
          </div>

          <Show when={match()?.endedAt}>
            <div class="alert alert-info">
              <span>
                Match ended:{" "}
                {match()?.winningTeam !== null
                  ? `Team ${match()!.winningTeam === 0 ? "1" : "2"} won`
                  : "Tie"}
              </span>
            </div>
          </Show>

          <Show when={match() && !match()!.endedAt}>
            <div class="text-center mb-4">
              <div class="text-4xl font-bold">{formatTime(elapsedTime())}</div>
              <div class="text-sm text-base-content/70">Elapsed Time</div>
            </div>
          </Show>

          <div class="divider"></div>

          <div class="grid grid-cols-2 gap-8">
            <div>
              <h3 class="text-2xl font-bold text-center mb-4">Team 1</h3>
              <div class="text-center mb-4">
                <div class="text-xl">Total Elo: {team0Elo()}</div>
              </div>
              <div class="space-y-2">
                <For each={match()?.team0 || []}>
                  {(player) => {
                    const anim = eloAnimations()[player.userId];
                    const currentElo = anim
                      ? anim.to
                      : player.eloAfter || player.eloBefore || 1500;
                    return (
                      <div class="card bg-base-200">
                        <div class="card-body p-4">
                          <div class="flex justify-between items-center">
                            <span class="font-semibold">{player.username}</span>
                            <div class="text-right">
                              <div
                                id={`elo-${player.userId}`}
                                class="text-lg font-bold"
                              >
                                {currentElo}
                              </div>
                              <Show
                                when={
                                  match()?.endedAt && player.eloChange !== null
                                }
                              >
                                <div
                                  class={`text-sm ${
                                    player.eloChange! > 0
                                      ? "text-success"
                                      : player.eloChange! < 0
                                      ? "text-error"
                                      : ""
                                  }`}
                                >
                                  {player.eloChange! > 0 ? "+" : ""}
                                  {player.eloChange}
                                </div>
                              </Show>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>

            <div>
              <h3 class="text-2xl font-bold text-center mb-4">Team 2</h3>
              <div class="text-center mb-4">
                <div class="text-xl">Total Elo: {team1Elo()}</div>
              </div>
              <div class="space-y-2">
                <For each={match()?.team1 || []}>
                  {(player) => {
                    const anim = eloAnimations()[player.userId];
                    const currentElo = anim
                      ? anim.to
                      : player.eloAfter || player.eloBefore || 1500;
                    return (
                      <div class="card bg-base-200">
                        <div class="card-body p-4">
                          <div class="flex justify-between items-center">
                            <span class="font-semibold">{player.username}</span>
                            <div class="text-right">
                              <div
                                id={`elo-${player.userId}`}
                                class="text-lg font-bold"
                              >
                                {currentElo}
                              </div>
                              <Show
                                when={
                                  match()?.endedAt && player.eloChange !== null
                                }
                              >
                                <div
                                  class={`text-sm ${
                                    player.eloChange! > 0
                                      ? "text-success"
                                      : player.eloChange! < 0
                                      ? "text-error"
                                      : ""
                                  }`}
                                >
                                  {player.eloChange! > 0 ? "+" : ""}
                                  {player.eloChange}
                                </div>
                              </Show>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
            </div>
          </div>

          <div class="divider"></div>

          <Show when={isHost() && match() && !match()!.endedAt}>
            <div class="card-actions justify-center">
              <button
                class="btn btn-primary btn-lg"
                onclick={() => setShowEndMatchModal(true)}
              >
                End Match
              </button>
            </div>
          </Show>

          <Show when={showEndMatchModal()}>
            <div class="modal modal-open">
              <div class="modal-box">
                <h3 class="font-bold text-lg mb-4">Select Winning Team</h3>
                <p class="mb-4 text-warning">
                  Warning: This cannot be changed after submission!
                </p>
                <div class="space-y-2">
                  <label class="label cursor-pointer">
                    <span class="label-text">Team 1</span>
                    <input
                      type="radio"
                      name="winningTeam"
                      class="radio radio-primary"
                      checked={selectedWinningTeam() === 0}
                      onchange={() => setSelectedWinningTeam(0)}
                    />
                  </label>
                  <label class="label cursor-pointer">
                    <span class="label-text">Team 2</span>
                    <input
                      type="radio"
                      name="winningTeam"
                      class="radio radio-primary"
                      checked={selectedWinningTeam() === 1}
                      onchange={() => setSelectedWinningTeam(1)}
                    />
                  </label>
                </div>
                <div class="modal-action">
                  <button
                    class="btn"
                    onclick={() => {
                      setShowEndMatchModal(false);
                      setSelectedWinningTeam(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    class="btn btn-primary"
                    disabled={selectedWinningTeam() === null}
                    onclick={async () => {
                      if (selectedWinningTeam() === null) return;
                      const formData = new FormData();
                      formData.append("matchId", String(matchId()));
                      formData.append(
                        "winningTeam",
                        String(selectedWinningTeam())
                      );
                      const result = await endMatchServer(formData);
                      if (result?.success) {
                        setShowEndMatchModal(false);
                        window.location.reload();
                      } else {
                        alert(result?.error || "Failed to end match");
                      }
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          </Show>
        </div>
      </div>
    </main>
  );
}
