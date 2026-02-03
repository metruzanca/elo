"use server";
import { redirect } from "@solidjs/router";
import { useSession } from "vinxi/http";
import { eq } from "drizzle-orm";
import { db } from "../../drizzle/db";
import { Users } from "../../drizzle/schema";
import { rateLimit, getClientIdentifier } from "../lib/rate-limit";
import {
  getDiscordAuthUrl,
  exchangeCodeForToken,
  getDiscordUser,
  getDiscordAvatarUrl,
  type DiscordUser,
} from "../lib/discord";

function validateUsername(username: unknown) {
  if (typeof username !== "string" || username.length < 3) {
    return `Usernames must be at least 3 characters long`;
  }
}

function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6) {
    return `Passwords must be at least 6 characters long`;
  }
}

async function login(username: string, password: string) {
  const user = await db
    .select()
    .from(Users)
    .where(eq(Users.username, username))
    .get();
  if (!user || password !== user.password) throw new Error("Invalid login");
  return user;
}

async function register(username: string, password: string) {
  const existingUser = await db
    .select()
    .from(Users)
    .where(eq(Users.username, username))
    .get();
  if (existingUser) throw new Error("User already exists");
  return db.insert(Users).values({ username, password }).returning().get();
}

export function getSession() {
  return useSession({
    password:
      process.env.SESSION_SECRET ?? "areallylongsecretthatyoushouldreplace",
  });
}

export async function loginOrRegister(formData: FormData) {
  // Rate limiting (lenient - skip if we can't identify client)
  // Server actions don't have direct access to request event in SolidStart
  // Rate limiting is primarily handled at the API route level

  const username = String(formData.get("username"));
  const password = String(formData.get("password"));
  const loginType = String(formData.get("loginType"));
  let error = validateUsername(username) || validatePassword(password);
  if (error) return new Error(error);

  try {
    const user = await (loginType !== "login"
      ? register(username, password)
      : login(username, password));
    const session = await getSession();
    await session.update((d) => {
      d.userId = user.id;
    });
  } catch (err) {
    return err as Error;
  }
  throw redirect("/");
}

export async function logout() {
  const session = await getSession();
  await session.update((d) => (d.userId = undefined));
  throw redirect("/login");
}

export async function getUser() {
  const session = await getSession();
  const userId = session.data.userId;
  if (userId === undefined) throw redirect("/login");

  try {
    const user = await db
      .select()
      .from(Users)
      .where(eq(Users.id, userId))
      .get();
    if (!user) throw redirect("/login");
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    };
  } catch {
    throw logout();
  }
}

// Discord OAuth functions
export async function isDiscordConfigured(): Promise<boolean> {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:110",
      message: "isDiscordConfigured entry",
      data: {
        clientId: !!process.env.DISCORD_CLIENT_ID,
        clientSecret: !!process.env.DISCORD_CLIENT_SECRET,
        redirectUri: !!process.env.DISCORD_REDIRECT_URI,
        clientIdVal:
          process.env.DISCORD_CLIENT_ID?.substring(0, 10) || "undefined",
        redirectUriVal: process.env.DISCORD_REDIRECT_URI || "undefined",
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  const result = !!(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_REDIRECT_URI
  );
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:116",
      message: "isDiscordConfigured exit",
      data: { result },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "A",
    }),
  }).catch(() => {});
  // #endregion
  return result;
}

export async function startDiscordAuth(redirectTo?: string) {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:118",
      message: "startDiscordAuth entry",
      data: { redirectTo: redirectTo || "undefined" },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  const session = await getSession();
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:120",
      message: "startDiscordAuth session retrieved",
      data: { sessionExists: !!session },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:123",
      message: "startDiscordAuth state generated",
      data: { state },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  await session.update((d) => {
    d.oauthState = state;
    d.oauthRedirectTo = redirectTo || "/";
  });
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:128",
      message: "startDiscordAuth session updated",
      data: {
        savedState: session.data.oauthState,
        savedRedirectTo: session.data.oauthRedirectTo,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  const authUrl = getDiscordAuthUrl(state);
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:130",
      message: "startDiscordAuth exit",
      data: { authUrl },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  return authUrl;
}

export async function handleDiscordCallback(code: string, state: string) {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:129",
      message: "handleDiscordCallback entry",
      data: { code: code?.substring(0, 20) || "undefined", state },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  const session = await getSession();
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:131",
      message: "handleDiscordCallback session retrieved",
      data: { sessionExists: !!session },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion
  const savedState = session.data.oauthState;
  const redirectTo = session.data.oauthRedirectTo || "/";
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:133",
      message: "handleDiscordCallback state check",
      data: {
        savedState,
        receivedState: state,
        statesMatch: savedState === state,
        redirectTo,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion

  // Clear OAuth state
  await session.update((d) => {
    d.oauthState = undefined;
    d.oauthRedirectTo = undefined;
  });

  // Validate state
  if (!savedState || savedState !== state) {
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "server.ts:142",
        message: "handleDiscordCallback state validation failed",
        data: { savedState, receivedState: state },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "B",
      }),
    }).catch(() => {});
    // #endregion
    throw new Error("Invalid OAuth state");
  }

  // Exchange code for token
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:146",
      message: "handleDiscordCallback before token exchange",
      data: { code: code?.substring(0, 20) || "undefined" },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  const tokenResponse = await exchangeCodeForToken(code);
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:147",
      message: "handleDiscordCallback token exchange success",
      data: {
        hasToken: !!tokenResponse.access_token,
        tokenType: tokenResponse.token_type,
      },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:148",
      message: "handleDiscordCallback before user fetch",
      data: {},
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion
  const discordUser = await getDiscordUser(tokenResponse.access_token);
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:149",
      message: "handleDiscordCallback user fetch success",
      data: { userId: discordUser.id, username: discordUser.username },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "C",
    }),
  }).catch(() => {});
  // #endregion

  // Find or create user
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:152",
      message: "handleDiscordCallback before findOrCreateUser",
      data: { discordUserId: discordUser.id },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion
  const user = await findOrCreateDiscordUser(discordUser);
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:153",
      message: "handleDiscordCallback findOrCreateUser success",
      data: { userId: user.id, username: user.username },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion

  // Set session
  await session.update((d) => {
    d.userId = user.id;
  });
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:158",
      message: "handleDiscordCallback exit",
      data: { redirectTo, userId: user.id },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "B",
    }),
  }).catch(() => {});
  // #endregion

  return redirectTo;
}

async function findOrCreateDiscordUser(discordUser: DiscordUser) {
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:160",
      message: "findOrCreateDiscordUser entry",
      data: { discordUserId: discordUser.id, username: discordUser.username },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion
  // Check if user exists with this Discord ID
  const existingUser = await db
    .select()
    .from(Users)
    .where(eq(Users.discordId, discordUser.id))
    .get();

  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:167",
      message: "findOrCreateDiscordUser query result",
      data: { existingUser: !!existingUser, existingUserId: existingUser?.id },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion

  const displayName = discordUser.global_name || discordUser.username;
  const avatarUrl = getDiscordAvatarUrl(discordUser);

  if (existingUser) {
    // Update display name and avatar if changed
    await db
      .update(Users)
      .set({ displayName, avatarUrl })
      .where(eq(Users.id, existingUser.id));
    // #region agent log
    fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "server.ts:177",
        message: "findOrCreateDiscordUser updated existing",
        data: { userId: existingUser.id },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "D",
      }),
    }).catch(() => {});
    // #endregion
    return { ...existingUser, displayName, avatarUrl };
  }

  // Create new user
  const username = `discord_${discordUser.id}`;
  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:181",
      message: "findOrCreateDiscordUser creating new",
      data: { username },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion
  const newUser = await db
    .insert(Users)
    .values({
      username,
      password: "", // No password for Discord users
      discordId: discordUser.id,
      displayName,
      avatarUrl,
    })
    .returning()
    .get();

  // #region agent log
  fetch("http://127.0.0.1:7246/ingest/571f972d-0875-4449-89e9-6bb90541c8fc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: "server.ts:194",
      message: "findOrCreateDiscordUser created new",
      data: { userId: newUser.id, username: newUser.username },
      timestamp: Date.now(),
      sessionId: "debug-session",
      runId: "run1",
      hypothesisId: "D",
    }),
  }).catch(() => {});
  // #endregion

  return newUser;
}
