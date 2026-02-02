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
  createLobby as cL,
  joinLobby as jL,
  leaveLobby as lL,
  getLobby as gL,
  getActiveLobbies as gAL,
  getUserActiveLobby as gUAL,
  inviteToLobby as iTL,
  setSpectator as sS,
  endLobby as eL,
} from "./lobbies";
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

export const createLobby = action(cL, "createLobby");
export const joinLobby = action(jL, "joinLobby");
export const leaveLobby = action(lL, "leaveLobby");
export const getLobby = query(gL, "lobby");
export const getActiveLobbies = query(gAL, "activeLobbies");
export const getUserActiveLobby = query(gUAL, "userActiveLobby");
export const inviteToLobby = action(iTL, "inviteToLobby");
export const setSpectator = action(sS, "setSpectator");
export const endLobby = action(eL, "endLobby");

export const startMatch = action(sM, "startMatch");
export const endMatch = action(eM, "endMatch");
export const cancelMatch = action(cM, "cancelMatch");
export const penalizePlayer = action(pP, "penalizePlayer");
export const getMatch = query(gM, "match");
export const getActiveMatch = query(gAM, "activeMatch");
export const getGroupMatchHistory = query(gGMH, "groupMatchHistory");
