import {
  eventHandler,
  getQuery,
  sendRedirect,
  setResponseStatus,
} from "vinxi/http";
import { startDiscordAuth, isDiscordConfigured } from "~/api/server";

export const GET = eventHandler(async (event) => {
  if (!isDiscordConfigured()) {
    setResponseStatus(event, 503);
    return "Discord OAuth not configured";
  }

  try {
    const query = getQuery(event);
    const redirectTo = (query.redirectTo as string) || "/";
    const authUrl = await startDiscordAuth(redirectTo);
    return sendRedirect(event, authUrl);
  } catch (error) {
    console.error("Discord auth error:", error);
    setResponseStatus(event, 500);
    return "Failed to start Discord authentication";
  }
});
