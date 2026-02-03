const DISCORD_API_URL = "https://discord.com/api/v10";
const DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name: string | null;
  avatar: string | null;
}

export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export function getDiscordAuthUrl(state: string): string {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:21",
      message: "getDiscordAuthUrl entry",
      data: {
        state,
        clientId: !!process.env.DISCORD_CLIENT_ID,
        redirectUri: !!process.env.DISCORD_REDIRECT_URI,
        redirectUriVal: process.env.DISCORD_REDIRECT_URI || "undefined",
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "discord.ts:26",
        message: "getDiscordAuthUrl env vars missing",
        data: { hasClientId: !!clientId, hasRedirectUri: !!redirectUri },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    throw new Error("Discord OAuth not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "identify",
    state,
  });

  const authUrl = `${DISCORD_OAUTH_URL}?${params.toString()}`;
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:37",
      message: "getDiscordAuthUrl exit",
      data: { authUrl },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  return authUrl;
}

export async function exchangeCodeForToken(
  code: string
): Promise<DiscordTokenResponse> {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:40",
      message: "exchangeCodeForToken entry",
      data: {
        code: code?.substring(0, 20) || "undefined",
        hasClientId: !!process.env.DISCORD_CLIENT_ID,
        hasClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        hasRedirectUri: !!process.env.DISCORD_REDIRECT_URI,
        redirectUriVal: process.env.DISCORD_REDIRECT_URI || "undefined",
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A,C",
    }),
  }).catch(() => {});
  // #endregion
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "discord.ts:47",
        message: "exchangeCodeForToken env vars missing",
        data: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasRedirectUri: !!redirectUri,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    throw new Error("Discord OAuth not configured");
  }

  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:51",
      message: "exchangeCodeForToken before fetch",
      data: { tokenUrl: DISCORD_TOKEN_URL },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  const response = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:65",
      message: "exchangeCodeForToken response received",
      data: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion

  if (!response.ok) {
    const error = await response.text();
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "discord.ts:66",
        message: "exchangeCodeForToken error",
        data: { status: response.status, error },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    throw new Error(`Failed to exchange code: ${error}`);
  }

  const result = await response.json();
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:70",
      message: "exchangeCodeForToken success",
      data: {
        hasAccessToken: !!result.access_token,
        tokenType: result.token_type,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  return result;
}

export async function getDiscordUser(
  accessToken: string
): Promise<DiscordUser> {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:73",
      message: "getDiscordUser entry",
      data: { hasToken: !!accessToken, apiUrl: `${DISCORD_API_URL}/users/@me` },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  const response = await fetch(`${DISCORD_API_URL}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:80",
      message: "getDiscordUser response received",
      data: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion

  if (!response.ok) {
    const errorText = await response.text();
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "discord.ts:81",
        message: "getDiscordUser error",
        data: { status: response.status, error: errorText },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    throw new Error("Failed to fetch Discord user");
  }

  const result = await response.json();
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "discord.ts:84",
      message: "getDiscordUser success",
      data: { userId: result.id, username: result.username },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  return result;
}

export function getDiscordAvatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
}
