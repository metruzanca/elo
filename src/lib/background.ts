import { db } from "../../drizzle/db";
import { PlaySessions } from "../../drizzle/schema";
import { eq, and, isNull, lt } from "drizzle-orm";
import { sseManager } from "./sse";

const AUTO_END_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export async function checkAndAutoEndPlaySessions() {
  const now = Date.now();
  const threshold = now - AUTO_END_THRESHOLD_MS;

  // Find play sessions where host hasn't been seen for > 1 hour
  const sessionsToEnd = await db
    .select()
    .from(PlaySessions)
    .where(
      and(
        isNull(PlaySessions.endedAt),
        lt(PlaySessions.hostLastSeenAt, threshold)
      )
    )
    .all();

  for (const session of sessionsToEnd) {
    // End the session
    await db
      .update(PlaySessions)
      .set({ endedAt: now })
      .where(eq(PlaySessions.id, session.id));

    // Broadcast SSE event
    sseManager.broadcastToPlaySession(session.id, {
      type: "play_session_ended",
      data: { playSessionId: session.id, reason: "host_offline" },
    });
  }

  return sessionsToEnd.length;
}

let intervalId: NodeJS.Timeout | null = null;

export function startBackgroundJobs() {
  if (intervalId) {
    return; // Already running
  }

  // Run immediately
  checkAndAutoEndPlaySessions().catch((err) => {
    console.error("Error in background job:", err);
  });

  // Then run every CHECK_INTERVAL_MS
  intervalId = setInterval(() => {
    checkAndAutoEndPlaySessions().catch((err) => {
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
