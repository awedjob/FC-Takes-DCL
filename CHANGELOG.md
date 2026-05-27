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
