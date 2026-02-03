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
  return !!(
    process.env.DISCORD_CLIENT_ID &&
    process.env.DISCORD_CLIENT_SECRET &&
    process.env.DISCORD_REDIRECT_URI
  );
}

export async function startDiscordAuth(redirectTo?: string) {
  const session = await getSession();
  // Generate a random state for CSRF protection
  const state = crypto.randomUUID();
  await session.update((d) => {
    d.oauthState = state;
    d.oauthRedirectTo = redirectTo || "/";
  });
  return getDiscordAuthUrl(state);
}

export async function handleDiscordCallback(code: string, state: string) {
  const session = await getSession();
  const savedState = session.data.oauthState;
  const redirectTo = session.data.oauthRedirectTo || "/";

  // Clear OAuth state
  await session.update((d) => {
    d.oauthState = undefined;
    d.oauthRedirectTo = undefined;
  });

  // Validate state
  if (!savedState || savedState !== state) {
    throw new Error("Invalid OAuth state");
  }

  // Exchange code for token
  const tokenResponse = await exchangeCodeForToken(code);
  const discordUser = await getDiscordUser(tokenResponse.access_token);

  // Find or create user
  const user = await findOrCreateDiscordUser(discordUser);

  // Set session
  await session.update((d) => {
    d.userId = user.id;
  });

  return redirectTo;
}

async function findOrCreateDiscordUser(discordUser: DiscordUser) {
  // Check if user exists with this Discord ID
  const existingUser = await db
    .select()
    .from(Users)
    .where(eq(Users.discordId, discordUser.id))
    .get();

  const displayName = discordUser.global_name || discordUser.username;
  const avatarUrl = getDiscordAvatarUrl(discordUser);

  if (existingUser) {
    // Update display name and avatar if changed
    await db
      .update(Users)
      .set({ displayName, avatarUrl })
      .where(eq(Users.id, existingUser.id));
    return { ...existingUser, displayName, avatarUrl };
  }

  // Create new user
  const username = `discord_${discordUser.id}`;
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

  return newUser;
}
