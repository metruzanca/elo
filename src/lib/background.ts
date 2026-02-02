import { db } from "../../drizzle/db";
import { Lobbies } from "../../drizzle/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import { sseManager } from "./sse";

const AUTO_END_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function checkAndAutoEndLobbies() {
  const now = Date.now();
  const threshold = now - AUTO_END_THRESHOLD_MS;

  // Find lobbies where host hasn't been seen for > 1 hour
  const lobbiesToEnd = await db
    .select()
    .from(Lobbies)
    .where(and(isNull(Lobbies.endedAt), lt(Lobbies.hostLastSeenAt, threshold)))
    .all();

  for (const lobby of lobbiesToEnd) {
    // End the lobby
    await db
      .update(Lobbies)
      .set({ endedAt: now })
      .where(eq(Lobbies.id, lobby.id));

    // Broadcast SSE event
    sseManager.broadcastToLobby(lobby.id, {
      type: "lobby_ended",
      data: { lobbyId: lobby.id, reason: "host_offline" },
    });
  }

  return lobbiesToEnd.length;
}

let intervalId: NodeJS.Timeout | null = null;

export function startBackgroundJobs() {
  if (intervalId) {
    return; // Already running
  }

  // Run immediately
  checkAndAutoEndLobbies().catch((err) => {
    console.error("Error in background job:", err);
  });

  // Then run every CHECK_INTERVAL_MS
  intervalId = setInterval(() => {
    checkAndAutoEndLobbies().catch((err) => {
      console.error("Error in background job:", err);
    });
  }, CHECK_INTERVAL_MS);
}

export function stopBackgroundJobs() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
