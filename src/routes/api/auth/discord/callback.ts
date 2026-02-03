import {
  eventHandler,
  getQuery,
  setResponseStatus,
  setHeaders,
} from "vinxi/http";
import { handleDiscordCallback, isDiscordConfigured } from "~/api/server";

export const GET = eventHandler(async (event) => {
  // Immediate sync log before any async operations
  console.log("Discord callback route handler called");
  try {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:9",
        message: "Discord callback route entry",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    const configured = await isDiscordConfigured();
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

  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;
  const error = query.error as string;
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "api/auth/discord/callback.ts:17",
      message: "Discord callback route query params",
      data: { hasCode: !!code, hasState: !!state, hasError: !!error, error },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion

  if (error) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:20",
        message: "Discord callback route Discord error",
        data: { error },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    console.error("Discord OAuth error:", error);
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 302;
      res.setHeader("Location", "/login?error=discord_denied");
      res.end();
      return;
    }
    return new Response("", {
      status: 302,
      headers: { Location: "/login?error=discord_denied" },
    });
  }

  if (!code || !state) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:25",
        message: "Discord callback route missing params",
        data: { hasCode: !!code, hasState: !!state },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 302;
      res.setHeader("Location", "/login?error=invalid_request");
      res.end();
      return;
    }
    return new Response("", {
      status: 302,
      headers: { Location: "/login?error=invalid_request" },
    });
  }

  try {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:30",
        message: "Discord callback route before handleDiscordCallback",
        data: { code: code.substring(0, 20), state },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    const redirectTo = await handleDiscordCallback(code, state);
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:32",
        message: "Discord callback route success",
        data: { redirectTo },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 302;
      res.setHeader("Location", redirectTo);
      res.end();
      return;
    }
    return new Response("", {
      status: 302,
      headers: { Location: redirectTo },
    });
  } catch (err) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:34",
        message: "Discord callback route error",
        data: {
          error: String(err),
          stack: err instanceof Error ? err.stack : undefined,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B,C,D",
      }),
    }).catch(() => {});
    // #endregion
    console.error("Discord callback error:", err);
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 302;
      res.setHeader("Location", "/login?error=discord_failed");
      res.end();
      return;
    }
    return new Response("", {
      status: 302,
      headers: { Location: "/login?error=discord_failed" },
    });
  } catch (outerErr) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "api/auth/discord/callback.ts:catch",
        message: "Discord callback route outer catch",
        data: {
          error: String(outerErr),
          stack: outerErr instanceof Error ? outerErr.stack : undefined,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B,C,D",
      }),
    }).catch(() => {});
    // #endregion
    console.error("Discord callback outer error:", outerErr);
    const nativeEvent = (event as any).nativeEvent || event;
    const res = nativeEvent.node?.res || nativeEvent.res;
    if (res && typeof res.statusCode !== "undefined") {
      res.statusCode = 500;
      res.end("Internal server error");
      return;
    }
    return new Response("Internal server error", { status: 500 });
  }
});
