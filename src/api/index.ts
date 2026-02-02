import { action, query } from "@solidjs/router";
import { getUser as gU, logout as l, loginOrRegister as lOR } from "./server";
import {
  createGroup as cG,
  joinGroup as jG,
  leaveGroup as lG,
  getUserGroups as gUG,
  getGroup as gG,
  regenerateInviteCode as rIC,
  getGroupLeaderboard as gGL,
} from "./groups";
import {
  createPlaySession as cPS,
  joinPlaySession as jPS,
  leavePlaySession as lPS,
  getPlaySession as gPS,
  getActivePlaySessions as gAPS,
  getUserActivePlaySession as gUAPS,
  inviteToPlaySession as iTPS,
  setSpectator as sS,
  endPlaySession as ePS,
} from "./play-sessions";
import {
  startMatch as sM,
  endMatch as eM,
  cancelMatch as cM,
  penalizePlayer as pP,
  getMatch as gM,
  getActiveMatch as gAM,
  getGroupMatchHistory as gGMH,
} from "./matches";

export const getUser = query(gU, "user");
export const loginOrRegister = action(lOR, "loginOrRegister");
export const logout = action(l, "logout");

export const createGroup = action(cG, "createGroup");
export const joinGroup = action(jG, "joinGroup");
export const leaveGroup = action(lG, "leaveGroup");
export const getUserGroups = query(gUG, "userGroups");
export const getGroup = query(gG, "group");
export const regenerateInviteCode = action(rIC, "regenerateInviteCode");
export const getGroupLeaderboard = query(gGL, "groupLeaderboard");

export const createPlaySession = action(cPS, "createPlaySession");
export const joinPlaySession = action(jPS, "joinPlaySession");
export const leavePlaySession = action(lPS, "leavePlaySession");
export const getPlaySession = query(gPS, "playSession");
export const getActivePlaySessions = query(gAPS, "activePlaySessions");
export const getUserActivePlaySession = query(gUAPS, "userActivePlaySession");
export const inviteToPlaySession = action(iTPS, "inviteToPlaySession");
export const setSpectator = action(sS, "setSpectator");
export const endPlaySession = action(ePS, "endPlaySession");

export const startMatch = action(sM, "startMatch");
export const endMatch = action(eM, "endMatch");
export const cancelMatch = action(cM, "cancelMatch");
export const penalizePlayer = action(pP, "penalizePlayer");
export const getMatch = query(gM, "match");
export const getActiveMatch = query(gAM, "activeMatch");
export const getGroupMatchHistory = query(gGMH, "groupMatchHistory");
