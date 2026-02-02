import {
  eventHandler,
  getRouterParam,
  setHeaders,
  setResponseStatus,
} from "vinxi/http";
import { sseManager, type SSEClient } from "~/lib/sse";
import { getUser } from "~/api/server";
import { getMatch } from "~/api/matches";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { PlaySessionParticipants, Matches } from "@/schema";
import { rateLimit, getClientIdentifier } from "~/lib/rate-limit";

export const GET = eventHandler(async (event) => {
  // Rate limiting
  const identifier = getClientIdentifier(event);
  const limit = rateLimit(identifier);
  if (!limit.allowed) {
    setResponseStatus(event, 429);
    setHeaders(event, {
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "0",
      "Retry-After": "60",
    });
    return "Too Many Requests";
  }
  const matchId = Number(getRouterParam(event, "matchId"));

  let user;
  try {
    user = await getUser();
  } catch (error) {
    setResponseStatus(event, 401);
    return "Unauthorized";
  }

  if (!matchId) {
    setResponseStatus(event, 400);
    return "Match ID required";
  }

  // Get match and verify user has access
  let match;
  try {
    match = await getMatch(matchId);
  } catch (error) {
    setResponseStatus(event, 404);
    return "Match not found";
  }

  // Get play session
  const playSession = await db
    .select()
    .from(Matches)
    .where(eq(Matches.id, matchId))
    .get();

  if (!playSession) {
    setResponseStatus(event, 404);
    return "Play session not found";
  }

  // Check if user is a participant
  const participant = await db
    .select()
    .from(PlaySessionParticipants)
    .where(
      and(
        eq(PlaySessionParticipants.playSessionId, playSession.playSessionId),
        eq(PlaySessionParticipants.userId, user.id)
      )
    )
    .get();

  if (!participant) {
    setResponseStatus(event, 403);
    return "Not a participant";
  }

  // Spectators don't get live updates, only match end
  const isSpectator = participant.isSpectator;

  // Set up SSE headers
  setHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const clientId = `${user.id}-${matchId}-${Date.now()}`;
  let isConnected = true;

  // Get the native response stream
  const nativeEvent = (event as any).nativeEvent || event;
  const res = nativeEvent.node?.res || nativeEvent.res;

  const client: SSEClient = {
    id: clientId,
    userId: user.id,
    matchId,
    send: (sseEvent) => {
      if (!isConnected || !res) return;
      // Spectators only get match_ended events
      if (isSpectator && sseEvent.type !== "match_ended") {
        return;
      }
      const data = `event: ${sseEvent.type}\ndata: ${JSON.stringify(
        sseEvent.data
      )}\n\n`;
      try {
        res.write(data);
      } catch (error) {
        isConnected = false;
      }
    },
    close: () => {
      isConnected = false;
      sseManager.removeClient(clientId);
    },
  };

  sseManager.addClient(client);

  // Send initial connection message
  setTimeout(() => {
    client.send({
      type: "match_started",
      data: { message: "Connected to match", isSpectator },
    });
  }, 100);

  // Handle client disconnect
  if (nativeEvent.node?.req) {
    nativeEvent.node.req.on("close", () => {
      client.close();
    });
  }

  // Keep connection alive with periodic ping
  const pingInterval = setInterval(() => {
    if (!isConnected || !res) {
      clearInterval(pingInterval);
      return;
    }
    try {
      res.write(": ping\n\n");
    } catch (error) {
      isConnected = false;
      clearInterval(pingInterval);
      client.close();
    }
  }, 30000); // Ping every 30 seconds

  // Return a readable stream
  return new ReadableStream({
    start(controller) {
      // Stream is managed by direct writes to res
    },
    cancel() {
      clearInterval(pingInterval);
      client.close();
    },
  });
});
