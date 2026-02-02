import {
  integer,
  text,
  sqliteTable,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const Users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
});

export const Groups = sqliteTable(
  "groups",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name"),
    inviteCode: text("invite_code").notNull(),
    createdAt: integer("created_at").notNull(),
    createdBy: integer("created_by")
      .notNull()
      .references(() => Users.id),
  },
  (table) => ({
    inviteCodeIdx: uniqueIndex("groups_invite_code_idx").on(table.inviteCode),
  })
);

export const GroupMembers = sqliteTable(
  "group_members",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => Groups.id),
    userId: integer("user_id")
      .notNull()
      .references(() => Users.id),
    joinedAt: integer("joined_at").notNull(),
  },
  (table) => ({
    groupUserIdx: uniqueIndex("group_members_group_user_idx").on(
      table.groupId,
      table.userId
    ),
  })
);

export const PlaySessions = sqliteTable("play_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id")
    .notNull()
    .references(() => Groups.id),
  hostId: integer("host_id")
    .notNull()
    .references(() => Users.id),
  createdAt: integer("created_at").notNull(),
  endedAt: integer("ended_at"),
  hostLastSeenAt: integer("host_last_seen_at").notNull(),
});

export const PlaySessionParticipants = sqliteTable(
  "play_session_participants",
  {
    playSessionId: integer("play_session_id")
      .notNull()
      .references(() => PlaySessions.id),
    userId: integer("user_id")
      .notNull()
      .references(() => Users.id),
    isSpectator: integer("is_spectator", { mode: "boolean" })
      .notNull()
      .default(false),
    joinedAt: integer("joined_at").notNull(),
  },
  (table) => ({
    sessionUserIdx: uniqueIndex(
      "play_session_participants_session_user_idx"
    ).on(table.playSessionId, table.userId),
  })
);

export const Matches = sqliteTable("matches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playSessionId: integer("play_session_id")
    .notNull()
    .references(() => PlaySessions.id),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  winningTeam: integer("winning_team"), // 0 = team1, 1 = team2, null = cancelled/tie
  matchSize: integer("match_size").notNull(),
  cancelled: integer("cancelled", { mode: "boolean" }).notNull().default(false),
});

export const MatchParticipants = sqliteTable(
  "match_participants",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => Matches.id),
    userId: integer("user_id")
      .notNull()
      .references(() => Users.id),
    team: integer("team").notNull(), // 0 = team1, 1 = team2
    eloBefore: integer("elo_before"),
    eloAfter: integer("elo_after"),
    eloChange: integer("elo_change"),
    penalized: integer("penalized", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (table) => ({
    matchUserIdx: uniqueIndex("match_participants_match_user_idx").on(
      table.matchId,
      table.userId
    ),
  })
);

export const EloScores = sqliteTable(
  "elo_scores",
  {
    groupId: integer("group_id")
      .notNull()
      .references(() => Groups.id),
    userId: integer("user_id")
      .notNull()
      .references(() => Users.id),
    elo: integer("elo").notNull().default(1500),
    gamesWon: integer("games_won").notNull().default(0),
    gamesLost: integer("games_lost").notNull().default(0),
    gamesTied: integer("games_tied").notNull().default(0),
    totalGames: integer("total_games").notNull().default(0),
    currentStreak: integer("current_streak").notNull().default(0),
    highestStreak: integer("highest_streak").notNull().default(0),
    lastPlayedAt: integer("last_played_at"),
  },
  (table) => ({
    groupUserIdx: uniqueIndex("elo_scores_group_user_idx").on(
      table.groupId,
      table.userId
    ),
  })
);
