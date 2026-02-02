import {
  eventHandler,
  getRouterParam,
  setHeaders,
  setResponseStatus,
} from "vinxi/http";
import { sseManager, type SSEClient } from "~/lib/sse";
import { getUser } from "~/api/server";
import { getPlaySession } from "~/api/play-sessions";
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
  const playSessionId = Number(getRouterParam(event, "playSessionId"));

  let user;
  try {
    user = await getUser();
  } catch (error) {
    setResponseStatus(event, 401);
    return "Unauthorized";
  }

  if (!playSessionId) {
    setResponseStatus(event, 400);
    return "Play session ID required";
  }

  // Verify user has access to this play session
  try {
    await getPlaySession(playSessionId);
  } catch (error) {
    setResponseStatus(event, 403);
    return "Unauthorized";
  }

  // Set up SSE headers
  setHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const clientId = `${user.id}-${playSessionId}-${Date.now()}`;
  let isConnected = true;
  let writeStream: any = null;

  // Get the native response stream
  const nativeEvent = (event as any).nativeEvent || event;
  const res = nativeEvent.node?.res || nativeEvent.res;

  const client: SSEClient = {
    id: clientId,
    userId: user.id,
    playSessionId,
    send: (sseEvent) => {
      if (!isConnected || !res) return;
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
      type: "player_joined",
      data: { message: "Connected to play session" },
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

  // Return a readable stream that writes to the response
  return new ReadableStream({
    start(controller) {
      writeStream = controller;
    },
    cancel() {
      clearInterval(pingInterval);
      client.close();
    },
  });
});
