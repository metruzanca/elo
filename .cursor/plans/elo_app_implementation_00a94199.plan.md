---
name: Elo App Implementation
overview: Build a complete Elo tracking webapp with groups, play sessions, matches, real-time updates via SSE, and Elo calculations with team balancing.
todos:
  - id: db-schema
    content: Create database schema for Groups, GroupMembers, PlaySessions, PlaySessionParticipants, Matches, MatchParticipants, EloScores
    status: completed
  - id: group-api
    content: Implement group management API endpoints (create, join, leave, list, regenerate invite)
    status: completed
  - id: play-session-api
    content: Implement play session API endpoints (create, join, leave, invite, set spectator, end)
    status: completed
  - id: elo-calculation
    content: Implement Elo calculation logic with team balancing and streak bonuses
    status: completed
  - id: match-api
    content: Implement match API endpoints (start, end, cancel, penalize)
    status: completed
  - id: sse-infrastructure
    content: Build SSE infrastructure for real-time updates (connection manager, broadcast system)
    status: completed
  - id: sse-endpoints
    content: Create SSE route handlers for play sessions and matches
    status: completed
  - id: dashboard-ui
    content: Build dashboard UI (home page with groups list, create/join group)
    status: completed
  - id: group-page-ui
    content: Build group page UI (leaderboard, play sessions list, create session)
    status: completed
  - id: play-session-ui
    content: Build play session page UI (host view, player view, real-time updates)
    status: completed
  - id: match-ui
    content: Build match UI (teams display, timer, end match, Elo animation)
    status: completed
  - id: match-history-ui
    content: Build match history page
    status: completed
  - id: background-jobs
    content: Implement background job for auto-ending play sessions when host offline >1hr
    status: completed
  - id: rate-limiting
    content: Add basic rate limiting middleware
    status: completed
isProject: false
---

# Elo App Implementation Plan

## Current State

- Basic auth system (username/password, cookie sessions)
- User table in database
- SolidStart app with routing
- Tailwind + daisyUI styling

## Database Schema

### Tables to create in `drizzle/schema.ts`:

1. **Groups**

- `id` (integer, primary key)
- `name` (text, optional)
- `inviteCode` (text, unique, indexed)
- `createdAt` (integer timestamp)
- `createdBy` (integer, foreign key to Users)

1. **GroupMembers**

- `groupId` (integer, foreign key)
- `userId` (integer, foreign key)
- `joinedAt` (integer timestamp)
- Unique constraint on (groupId, userId)

1. **PlaySessions**

- `id` (integer, primary key)
- `groupId` (integer, foreign key)
- `hostId` (integer, foreign key to Users)
- `createdAt` (integer timestamp)
- `endedAt` (integer timestamp, nullable)
- `hostLastSeenAt` (integer timestamp, for auto-end logic)

1. **PlaySessionParticipants**

- `playSessionId` (integer, foreign key)
- `userId` (integer, foreign key)
- `isSpectator` (integer, boolean, default 0)
- `joinedAt` (integer timestamp)
- Unique constraint on (playSessionId, userId)

1. **Matches**

- `id` (integer, primary key)
- `playSessionId` (integer, foreign key)
- `startedAt` (integer timestamp)
- `endedAt` (integer timestamp, nullable)
- `winningTeam` (integer, nullable: 0=team1, 1=team2, null=cancelled/tie)
- `matchSize` (integer)
- `cancelled` (integer, boolean, default 0)

1. **MatchParticipants**

- `matchId` (integer, foreign key)
- `userId` (integer, foreign key)
- `team` (integer: 0=team1, 1=team2)
- `eloBefore` (integer, nullable for first match)
- `eloAfter` (integer, nullable if cancelled)
- `eloChange` (integer, nullable)
- `penalized` (integer, boolean, default 0)
- Unique constraint on (matchId, userId)

1. **EloScores**

- `groupId` (integer, foreign key)
- `userId` (integer, foreign key)
- `elo` (integer, default 1500)
- `gamesWon` (integer, default 0)
- `gamesLost` (integer, default 0)
- `gamesTied` (integer, default 0)
- `totalGames` (integer, default 0)
- `currentStreak` (integer, default 0)
- `highestStreak` (integer, default 0)
- `lastPlayedAt` (integer timestamp, nullable)
- Unique constraint on (groupId, userId)

## API Endpoints (`src/api/server.ts`)

### Group Management

- `createGroup(name?: string)` - Create group, generate invite code
- `joinGroup(inviteCode: string)` - Join group via invite code
- `leaveGroup(groupId: number)` - Leave group (with warning about data deletion)
- `getUserGroups()` - List user's groups
- `getGroup(groupId: number)` - Get group details
- `regenerateInviteCode(groupId: number)` - Generate new invite code
- `getGroupLeaderboard(groupId: number)` - Get leaderboard with stats

### Play Session Management

- `createPlaySession(groupId: number)` - Create play session, user becomes host
- `joinPlaySession(playSessionId: number)` - Join play session
- `leavePlaySession(playSessionId: number)` - Leave play session
- `getPlaySession(playSessionId: number)` - Get play session details
- `getActivePlaySessions(groupId: number)` - List active play sessions in group
- `inviteToPlaySession(playSessionId: number, userIds: number[])` - Invite players
- `setSpectator(playSessionId: number, userId: number, isSpectator: boolean)` - Set spectator status
- `endPlaySession(playSessionId: number)` - End play session (host only)
- `updateHostLastSeen(playSessionId: number)` - Update host last seen timestamp

### Match Management

- `startMatch(playSessionId: number, matchSize: number)` - Start match with team balancing
- `endMatch(matchId: number, winningTeam: 0 | 1)` - End match, calculate Elo changes
- `cancelMatch(matchId: number)` - Cancel match (no Elo changes)
- `penalizePlayer(matchId: number, userId: number)` - Mark player as penalized
- `getMatch(matchId: number)` - Get match details
- `getActiveMatch(playSessionId: number)` - Get active match in play session

### Elo Calculation (`src/lib/elo.ts`)

- `calculateEloChange(playerElo: number, opponentTeamAvgElo: number, won: boolean, kFactor: number, streakBonus: number)` - Calculate Elo change
- `balanceTeams(players: Array<{userId: number, elo: number}>, matchSize: number)` - Team balancing algorithm
- `selectPlayersForMatch(participants: Array<{userId: number, isSpectator: boolean, gamesPlayed: number}>, matchSize: number)` - Select players ensuring similar gametime

### SSE Endpoints (`src/api/sse.ts`)

- `GET /api/sse/play-session/:playSessionId` - SSE stream for play session updates
- `GET /api/sse/match/:matchId` - SSE stream for match updates (players only, not spectators)
- Event types: `play_session_invite`, `player_joined`, `player_left`, `match_started`, `match_ended`, `elo_update`

### SSE Infrastructure (`src/lib/sse.ts`)

- SSE connection manager to track active connections
- Broadcast events to relevant connections
- Handle connection cleanup

## Routes (`src/routes/`)

1. `**/` (index.tsx) - Dashboard

- List user's groups
- Create new group button
- Join group via invite code input

1. `**/groups/:groupId**` - Group page

- Leaderboard with stats (Elo, games won/lost, win %, last game, total games, streaks)
- List active play sessions
- Create new play session button
- Leave group button (with warning)

1. `**/play-sessions/:playSessionId**` - Play session page

- Host view: invite players, start match, assign spectators, end session
- Player view: see participants, wait for match
- Show active match if exists
- Real-time updates via SSE

1. `**/matches/:matchId**` - Match view

- Show teams with Elo scores
- Elapsed time since start
- Host: end match button with team selection
- Players: view-only during match
- On match end: Elo animation with +/- change display
- Spectators: view match info but no live updates

1. `**/groups/:groupId/history**` - Match history

- List all matches in group
- Show date, teams, Elo changes per player

## UI Components (`src/components/`)

1. **Leaderboard** - Table showing player stats
2. **TeamDisplay** - Show team with players and Elo
3. **EloAnimation** - Animated Elo change display (using solid-motionone)
4. **MatchTimer** - Display elapsed time
5. **PlayerSelector** - Multi-select for inviting players
6. **SpectatorToggle** - Toggle spectator status
7. **InviteCodeDisplay** - Show invite code with copy button

## Real-time Updates

### SSE Implementation

- Create SSE route handlers in `src/routes/api/sse/`
- Use EventSource API on client
- Broadcast events when:
  - Play session created/ended
  - Player joins/leaves play session
  - Match starts/ends
  - Elo changes
- Handle reconnection logic
- Clean up connections on disconnect

### Client SSE Hook (`src/hooks/useSSE.ts`)

- Custom hook for managing SSE connections
- Auto-reconnect on disconnect
- Parse and handle different event types

## Elo Algorithm Details

### Team Balancing

- Use average Elo per team
- Try all combinations, pick smallest difference
- Consider gametime fairness (track games played per session)
- Use 1500 for players without Elo

### Elo Calculation

- K-factor: 40
- Streak bonus: 4% per win, max 3 wins (12% total)
- Formula: `Elo_new = Elo_old + K_adjusted × (actual - expected)`
- Expected score: `1 / (1 + 10^((opponent_avg - player_elo) / 400))`
- Individual calculation per player vs opponent team average

### Streak Tracking

- Increment on win, reset on loss
- Track per group
- Update in EloScores table

## Background Jobs

### Auto-end Play Sessions (`src/lib/background.ts`)

- Check for play sessions where host offline > 1 hour
- End sessions automatically
- Run as periodic check (every 15 minutes)

## Rate Limiting

- Basic rate limiting middleware
- Lenient limits (e.g., 100 req/min per IP)
- Apply to API endpoints

## Implementation Order

1. Database schema and migrations
2. Group management (CRUD, invite codes)
3. Play session management
4. Match management and Elo calculation
5. SSE infrastructure
6. UI routes and components
7. Real-time updates integration
8. Elo animation UI
9. Leaderboard and stats
10. Match history
11. Background jobs (auto-end sessions)
12. Rate limiting
13. Polish and edge cases

## Unresolved Questions

1. Should invite codes be UUIDs or human-readable codes?
2. What should be the default match size if not specified?
3. Should there be a maximum match size limit despite "no limit" requirement?
4. How should we handle password hashing? (Currently plaintext in README says "no restriction")
5. Should we add pagination for match history?
6. What should happen if a player is in multiple active matches across different play sessions? (README says "within same play session" only)
7. Should we add validation for match size (e.g., must be even number for 2 teams)?
