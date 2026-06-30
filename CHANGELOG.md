# FC-Takes-DCL — Change Log

## Bug Fixes

**Passive avatar scoring bug (target.ts)** — Players standing near the target as spectators were receiving scores when another player landed. The root cause was that `utils.triggers` fires on all clients, and standing players at ground level (y≈0.88) were within the trigger zone's y range. Fixed by adding a `localPlayerJumping` flag that is only set to `true` when the local player is detected at the arch jump platform height (y≈43). Scores are only recorded if this flag is set, making it impossible for passive observers to receive scores.

**Multiplayer scoring bug (target.ts)** — When another player landed on the target, the score was incorrectly recorded and displayed for all other players in the scene. Fixed by adding a proximity check inside the landing trigger callback to verify the local player is actually on the target before recording a score.

**Score display timer (target.ts)** — The score was disappearing from the screen too quickly due to `setInterval` being used instead of `setTimeout`, causing repeated timer callbacks to stack up. Switched to `setTimeout` so the score displays reliably for 5 seconds then clears once.

**Triple `compareToCenter` call (target.ts)** — The distance calculation function was being called three times per landing, creating three stacking timers. Distance is now calculated once and stored in a variable that is reused.

**archTeleport.ts build error** — Fixed a syntax error (missing comma after the enter callback closing brace) that was breaking the scene build.

**Leaderboard portal not triggering (teleport.ts)** — The portal trigger was attached to a parented entity. The `utils.triggers` library does not correctly compute world positions for parented entities, placing the trigger zone in the wrong location. Fixed by creating a separate unparented trigger entity positioned at the portal's known world coordinates (22.7, 2, 2.9).

---

## Game Mechanics

**Glider and double jump disabled (index.ts)** — Added `InputModifier` using the explicit mode syntax to disable gliding and double jumping scene-wide. This prevents players from using the glider to slow their descent and gain an unfair positional advantage over the target. The modifier is applied via a one-time system that waits for the player entity to be fully initialized before running, which was required for the restriction to take effect in the deployed scene.

---

## UI Improvements

**Score display (ui.tsx, target.ts)** — Completely redesigned the post-jump score display. The score now appears in a white panel with the Jump Zone logo centered above it. Text is split across two lines ("distance is" / "[value] meters"), uses a sans-serif font, and the white panel only renders when a score is actively being shown. A minimum width was added to the panel to prevent "distance is" from wrapping across multiple lines.

**Jump Zone logo (assets/scene/JumpZone.png)** — Rotated 90° clockwise so the logo renders correctly in the UI panel.

---

## Leaderboard

**Name and score spacing (leaderboard.ts)** — Increased the horizontal distance between player names and scores from ±2.5 to ±3 units to prevent longer names from overlapping with score values.

## [Unreleased] - 2026-06-30

### Server (server/src/index.ts)
- Added `/reset-scores` DELETE endpoint to clear all scores from the SQLite database
- Deployed to Railway (fartarget-production.up.railway.app)
- Reset procedure: `railway up` from `server/` directory, then `curl -X DELETE https://fartarget-production.up.railway.app/reset-scores`

#### Weekly rotation reliability (root-cause fix for skipped weeks)
- **PRIMARY root cause — SQLite ISO-week incompatibility:** every week query used `strftime('%G-W%V', timestamp)`, but the bundled SQLite is **3.44.2** and the `%G`/`%V` codes were only added in **3.46.0**. They returned `NULL`, so `WHERE strftime('%G-W%V', timestamp) = '2026-Wxx'` matched **zero rows** — finalization always reported "no eligible winner", never recorded a champion, never reset. Weekly automation had in fact *never* worked; all prior champions (W20–W24) were entered manually via `/add-winner` (note the June 12/15 backfilled `won_at` values). Fixed by computing ISO weeks in **JS** and matching scores by **UTC datetime range** (`timestamp >= start AND timestamp < end`) in `finalizeWeeklyWinner()`, `catchUpMissedWeeks()`, and `/debug/scores` — no more `strftime` week codes. Added helpers `isoWeekToRange()`, `toSqlUTC()`, `parseSqlUTC()`; made `getISOWeek()` UTC-correct.
- **Secondary cause — no missed-run recovery:** finalization (champion + leaderboard reset) is a single atomic op inside `finalizeWeeklyWinner()`, run only by an in-process `node-cron` Sunday-23:59-UTC tick. Even once week-matching works, a redeploy/restart/sleep across that tick would skip a week with no retry.
- Added `catchUpMissedWeeks()` — runs on every startup, finalizing any *past* week that has scores but no recorded champion. Self-heals weeks the cron missed. The current (active) week is never touched.
- Added per-week prize history (`weekly_prizes` table) so each backlogged week is crowned with *its own* correct prize instead of whatever the single `current_prize` row currently holds. `finalizeWeeklyWinner()` now resolves prize by week (falls back to `current_prize` for legacy weeks).
- `/set-prize` now also writes `weekly_prizes` for its `week_label`, so normal weekly operation auto-populates history.
- New endpoints: `POST /set-weekly-prize` (backfill/correct a specific week's prize without touching the live display) and `GET /weekly-prizes` (inspect history).
- Catch-up **defers** any missed week that has no prize on record (logs it) rather than guessing — so a recovered week is never crowned with the wrong prize. Set the prize via `/set-weekly-prize`, then it finalizes on the next boot or via `/finalize-week`.
- One-time migration seeds `weekly_prizes` from the live `current_prize` (captures W25 = Warplet Skin).

### Scene (src/teleport.ts)
- Updated trigger entity world position from `x: 22.7, z: 2.9` to `x: 22.31, z: 3.81` to match actual portal location after estate expansion
- Changed trigger layers from `1, 1` to `4, 4` to avoid conflicts with other triggers
- Leaderboard portal trigger now firing correctly — resolved during subsequent work

### Scene (src/index.ts)
- Added temporary position logger system for debugging (should be removed before deployment)

### Infrastructure
- Estate expanded from 8 to 13 parcels
- Base parcel confirmed as `-131,89`
- Scoreboard was reset for new competition period

### Resolved
- Leaderboard portal teleport trigger not firing — no longer reproduces; fixed or obviated by subsequent changes
- Grass from adjacent parcels bleeding through the bullseye target area — no longer an issue