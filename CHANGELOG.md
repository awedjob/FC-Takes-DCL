# FC-Takes-DCL — Change Log

## Bug Fixes

**Multiplayer scoring bug (target.ts)** — When another player landed on the target, the score was incorrectly recorded and displayed for all other players in the scene. Fixed by adding a proximity check inside the landing trigger callback to verify the local player is actually on the target before recording a score.

**Score display timer (target.ts)** — The score was disappearing from the screen too quickly due to `setInterval` being used instead of `setTimeout`, causing repeated timer callbacks to stack up. Switched to `setTimeout` so the score displays reliably for 5 seconds then clears once.

**Triple `compareToCenter` call (target.ts)** — The distance calculation function was being called three times per landing, creating three stacking timers. Distance is now calculated once and stored in a variable that is reused.

**archTeleport.ts build error** — Fixed a syntax error (missing comma after the enter callback closing brace) that was breaking the scene build.

**Leaderboard portal not triggering (teleport.ts)** — The portal trigger was attached to a parented entity. The `utils.triggers` library does not correctly compute world positions for parented entities, placing the trigger zone in the wrong location. Fixed by creating a separate unparented trigger entity positioned at the portal's known world coordinates (22.7, 2, 2.9).

---

## Game Mechanics

**Glider and double jump disabled (index.ts)** — Added `InputModifier` using the explicit mode syntax to disable gliding and double jumping scene-wide. This prevents players from using the glider to slow their descent and gain an unfair positional advantage over the target.

---

## UI Improvements

**Score display (ui.tsx, target.ts)** — Completely redesigned the post-jump score display. The score now appears in a white panel with the Jump Zone logo centered above it. Text is split across two lines ("distance" / "[value] meters"), uses a sans-serif font, and the white panel only renders when a score is actively being shown.

**Jump Zone logo (assets/scene/JumpZone.png)** — Rotated 90° clockwise so the logo renders correctly in the UI panel.

---

## Leaderboard

**Name and score spacing (leaderboard.ts)** — Increased the horizontal distance between player names and scores from ±2.5 to ±3 units to prevent longer names from overlapping with score values.
