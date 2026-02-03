import {
  eventHandler,
  getQuery,
  sendRedirect,
  setResponseStatus,
} from "vinxi/http";
import { handleDiscordCallback, isDiscordConfigured } from "~/api/server";

export const GET = eventHandler(async (event) => {
  if (!isDiscordConfigured()) {
    setResponseStatus(event, 503);
    return "Discord OAuth not configured";
  }

  const query = getQuery(event);
  const code = query.code as string;
  const state = query.state as string;
  const error = query.error as string;

  if (error) {
    console.error("Discord OAuth error:", error);
    return sendRedirect(event, "/login?error=discord_denied");
  }

  if (!code || !state) {
    setResponseStatus(event, 400);
    return sendRedirect(event, "/login?error=invalid_request");
  }

  try {
    const redirectTo = await handleDiscordCallback(code, state);
    return sendRedirect(event, redirectTo);
  } catch (err) {
    console.error("Discord callback error:", err);
    return sendRedirect(event, "/login?error=discord_failed");
  }
});
