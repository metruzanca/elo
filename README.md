## Elo App

Elo is a webapp for tracking elo stats of custom games between friends. It's built for overwatch but could be used with any other competitive games where you'd like to keep player stats.

Elo is not a way to keep track of your MMR rank, it is purely for custom scims with friends.

## Implementation notes

- Elo does not send emails. Invites are via custom links that have invite codes as query params.
- Real-time implemented as SSE (Server-Sent Events). SSE connections are used for real-time updates throughout the app to avoid players having to click around. In ideal conditions, the host should be the only one who needs to click around - players and spectators can focus on playing the game and will receive automatic updates.
- Auth is username + password, no emails.
  - No restriction or requirement on passwords.
  - Session management is cookie-based.
- Basic rate limiting on the lenient side.

## User stories

- Host of game night, creates an account, creates a group and invites all other players.
- Invited player makes an account, and joins the group.
- User can independently make an account and then join a group via an invite code.
- Someone in a group can start a new lobby and invite players from that group via real-time invites.
- Invited players receive real-time invites and can join the lobby.
- Once players are in the lobby, the creator becomes the host. Only the host can start/end matches and assign win/loss.
- Host can start a match, and a random selection of non-spectator players is selected and teams are balanced based on their Elo scores. Ideally all players should see similar gametime within a lobby.
  - If a player has no score, their score is assumed to be 1500 (starting Elo) for team balancing purposes.
- Host can end a match and pick the winning side, at which point all players in the game will see their screen show win/loss and see their elo go up/down just like in the old days of overwatch 1.
- Players in a match can keep the app open while playing and when the host ends the match they can see their score go up or down.

  - Players will only see the animation of elo score going up or down when they are focussed on the tab.

- Groups

  - Groups are used as the basis for elo score.
  - A player in two different groups can have different scores, even if the activity of the group is the same. (activity is not a concept we care about)
  - Players can belong to multiple groups
  - Groups have no "admins", everyone in the group is equal and can invite others. Anyone within the group can create a lobby.
  - Players leaving a group will have their match history/elo deleted. (user should be warned of this when they try to leave)
  - Invites do not expire, but can be revoked and regenerated
  - Players elo score within the group is visible to everyone else.
  - No limit on group size or match size. We want to account for all possible games/activities that might want to track elo scores.
  - Within the same group, there can be multiple lobbies running simultaneously.

- Lobbies

  - Lobbies exist within groups. At the start of a day/night/event, someone in the group can start a new lobby and invite players from that group.
  - Invited players receive real-time invites via SSE and can join the lobby.
  - The creator of the lobby becomes the host. Only the host can start/end matches and assign win/loss.
  - Players can leave a lobby at any point if they desire.
  - Host can invite more players than there are game slots (before and during the lobby).
  - Host can manually assign spectators within the lobby.
  - Hosts can end a lobby at will, players can leave one at will.
  - If a host's SSE connection is broken and they're offline for at least 1 hour, the lobby is auto-ended.
  - Within the same lobby, there can only be 1 active match at a time.
  - A lobby can have many matches. When a match within a lobby concludes, the lobby itself does not conclude. The lobby only ends when the host ends it or when the host is offline for at least 1 hour.
  - Spectators are players in the lobby who have been manually assigned as spectators by the host. They are able to view an active match from within the lobby. Spectators can only see match information (teams, players, Elo scores) and when the match ends - they do not receive live updates during the match.

- Match

  - Matches exist within lobbies.
  - Match size is configurable and there's no size limit
  - When a match is started, a random selection of non-spectator players from the lobby is selected and teams are balanced based on their Elo scores. The algorithm should ideally ensure all players see similar gametime within a lobby.
  - A match can be cancelled if so, Elo does not change.
  - If a user leaves the Elo app mid match, nothing happens, their elo is calculated as usual at the end without penalty.
  - If the host disconnects during a match, they must reopen the app to end the match. No other player can end the match.
  - The host of a match can penalize a player at their own discretion, this player will not gain elo if they win but can lose if their team loses. A penalized player's streak does not reset if they win (since they don't gain Elo).
  - Players can view match history
  - match data is permanently stored until the last player of a group leaves the group, at which point the group is deleted automatically.
  - match history includes the following data: date, teams, elo changes
  - A player cannot be in multiple active matches within the same lobby.

- Elo

  - Elo is tracked per group, as each group could be a different game/activity (e.g. overwatch, valorant, league, chess!). This Elo app is for private gaming tournaments/scrims.
  - Starting Elo is 1500
  - If a player joins a group and never plays, they won't have elo.
  - For a player's first match, they start at 1500 (starting Elo) and then gain or lose Elo based on the match result. After their first match, they have an Elo rating and subsequent matches use their actual Elo rating.
  - K-Factor of 40 for more responsive changes.
  - Team balancing uses average Elo per team. If perfect balance is not possible, the algorithm selects the team composition with the smallest difference in average Elo between teams.
  - Elo calculation uses standard Elo formula: each player's Elo change is calculated individually based on their own Elo rating versus the opponent team's average Elo. Team composition variance (e.g., one high-rated player with several low-rated players) does not affect individual Elo calculations - each player's change is based solely on their individual skill level relative to the opponent team average.
  - Streaks: Players on a winning streak receive a bonus multiplier to their K-factor. The bonus is 4% per consecutive game win, capped at 3 consecutive games for a maximum 12% bonus. The adjusted K-factor is calculated as: `K_adjusted = K × (1 + streak_bonus)`. Streaks reset when a player loses. Streaks are tracked per group.
  - If there is a tie, no elo loss/gain but the match is still recorded in each player's history.

- UI

  - On the elo animation screen, it should show +/- exact change in smaller characters below the big number that just finished animating.
  - No match timer, but it should record starting and end times.
  - During a match, players should see match in progress with elapsed time since start as well as the two teams on either side of the screen with individual elo score and total elo score for the team. Spectators can view match information but do not receive live updates - they only see updates when the match ends.
  - When selecting the winning team, the host will be asked to confirm which team has won as changing the results is not possible.
  - There should be a leaderboard within each group showing stats for each player: Elo, games won, win %, last game played, total games played, games lost, highest win streak and current win streak.
  - When a host starts a match, the Elo app randomly selects non-spectator players from the lobby, optimizes the game and picks the teams based on selected player's elos (using average Elo for balance, choosing the closest balance if perfect balance isn't possible, ideally ensuring similar gametime for all players) and the host will be able to click Start when the match officially begins.
  - During match setup, players' current streak status is visible alongside their Elo scores.
