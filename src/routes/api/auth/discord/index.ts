import {
  eventHandler,
  getQuery,
  setResponseStatus,
  setHeaders,
} from "vinxi/http";
import { startDiscordAuth, isDiscordConfigured } from "~/api/server";

export const GET = eventHandler(async (event) => {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "api/auth/discord/index.ts:9",
      message: "Discord auth route entry",
      data: {},
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  const configured = await isDiscordConfigured();
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "api/auth/discord/index.ts:11",
      message: "Discord auth route config check",
      data: { configured },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  if (!configured) {
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 503;
      res.end("Discord OAuth not configured");
      return;
    }
    return new Response("Discord OAuth not configured", { status: 503 });
  }

  try {
    const query = getQuery(event);
    const redirectTo = (query.redirectTo as string) || "/";
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/index.ts:18",
        message: "Discord auth route before startDiscordAuth",
        data: { redirectTo },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    const authUrl = await startDiscordAuth(redirectTo);
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/index.ts:20",
        message: "Discord auth route redirecting",
        data: { authUrl },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    // Get the native response object
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 302;
      res.setHeader("Location", authUrl);
      res.end();
      return;
    }
    // Fallback: use Response constructor
    return new Response("", {
      status: 302,
      headers: { Location: authUrl },
    });
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/index.ts:21",
        message: "Discord auth route error",
        data: { error: String(error) },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A,B",
      }),
    }).catch(() => {});
    // #endregion
    console.error("Discord auth error:", error);
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 500;
      res.end("Failed to start Discord authentication");
      return;
    }
    return new Response("Failed to start Discord authentication", {
      status: 500,
    });
  }
});
