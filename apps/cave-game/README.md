# cave-game

## Current Status

This is a Vite + Wayfare prototype for a 2D platformer with Matter.js physics. It renders simple colored rectangles for the player, platforms, grapple points, and grapple rope. The app currently runs from `apps/cave-game` and is included in the pnpm workspace through the existing `apps/**` workspace pattern.

Implemented so far:

- Wayfare renderer and orthographic camera setup.
- Matter.js player body, static platform level, grapple point anchors, and rope constraint.
- Touch controls with left movement/look joystick and right gesture/action zone.
- Desktop keyboard controls.
- Dynamic camera follow with look-direction anticipation.
- Grapple target selection based on nearest point in the player's look direction.
- Basic Vite app shell and mobile landscape styling.

Last known verification:

- `node_modules/.bin/oxfmt --check apps/cave-game/src/input.ts apps/cave-game/README.md`
- `node_modules/.bin/oxlint apps/cave-game`
- `node_modules/.bin/vite build` from `apps/cave-game`
- Browser smoke tests showed the canvas rendering with no console errors.

Known verification caveat: `tsc --noEmit -p apps/cave-game/tsconfig.json` currently reports existing TypeScript errors in `packages/wayfare` source files imported directly by the app, before app-specific checking can complete.

## Running Locally

From the repo root:

```sh
pnpm --filter cave-game dev:watch
```

If `pnpm` tries to use the wrong version, use Corepack:

```sh
corepack pnpm --filter cave-game dev:watch
```

The development server has been tested at `http://127.0.0.1:5173/`.

## Plan

`cave-game` will be a landscape-first mobile platformer prototype built as a Vite app on top of Wayfare. The first pass will keep the visuals intentionally simple: colored rectangles for the player, terrain, grapple points, hook rope, and UI touch areas. The game logic will be organized inside `src/` rather than a shared package for now, because this is a focused prototype.

## Physics

Use `matter-js` for the lightweight 2D physics layer. It is small enough for a browser prototype, supports dynamic rigid bodies and static platforms, and includes constraints that fit a tap-and-hold grappling hook rope without needing to hand-roll spring or pendulum math.

The physics world will use Matter bodies as the source of truth for movement and collision. Wayfare entities will mirror body positions and rotations each frame so rendering stays separate from simulation.

Current tuning in `src/physics.ts`:

- Player collision size: `0.55 x 0.9`.
- Player natural visual size: `0.68 x 0.72`, stretching toward `0.46 x 1.08` while jumping upward.
- Player/platform contact friction: `0`, so horizontal control comes from the velocity controller instead of Matter surface friction.
- Movement speed scale: `0.8`.
- Free walk speed cap: `0.168`.
- Grapple movement speed cap: `0.132`.
- Grapple selection range: `12.6`.
- Velocity clamp: `{ x: 0.5, y: 0.45 }`.
- Gravity scale: `0.0000982`.
- Jump velocity: `-0.68`.
- Jump lockout: `0.14s`, plus a small upward translation to break platform contact.
- Dash velocity: `0.26`.
- Air dash: one dash before touching the ground again.
- Dash gravity cancel: `0.18s`.
- Dash visual stretch: `+42%` width and `-28%` height, easing back over the dash.
- Slam velocity: `0.52`.

## Controls

The app will use two full-height touch zones:

- Left half: movement and look joystick.
- Right half: gesture/action joystick.

Left joystick output controls horizontal movement and look direction. The most recent meaningful look direction will be used for camera anticipation and grapple targeting.

Right touch gestures:

- Up swipe: jump.
- Left swipe: dash left.
- Right swipe: dash right.
- Down swipe: ground slam.
- Tap and hold: attach the grappling hook to the currently selected grapple point.
- While holding the grapple: drag left or right to dash without releasing the rope.

Pointer input will also work with mouse for desktop testing.

Desktop keyboard input:

- WASD: movement and look direction.
- Space: jump.
- Shift + A: dash left.
- Shift + D: dash right.
- Shift + S: ground slam.

## Grappling Hook

Grapple points will be static world anchors. Each frame, the game will choose the nearest reachable grapple point in the player's look direction. Selection will prefer points that are:

- In front of the player's current look vector.
- Near the player's aim ray.
- Within a practical hook range.

When the right touch area is held without becoming a swipe, the player will attach to the selected point with a Matter constraint. Releasing the hold will remove the constraint.

## Camera

The camera will be an orthographic Wayfare camera looking at the XY plane. It will follow the player with smoothing and offset its target slightly in the current look direction so the player can see more of the cave in the direction they are moving or aiming.

## Initial World

The prototype level will include:

- A few static platforms and cave walls, with the ceiling at `y=7.1`.
- Several grapple points spread across the wider room near the raised ceiling.
- A player rectangle with grounded movement, jump, dash, slam, and grapple behavior.
- Minimal HUD/touch feedback showing both joysticks, the selected grapple point, and active rope.

## File Layout

- `src/main.ts`: app bootstrap, WebGPU setup, resize handling, and game start.
- `src/game.ts`: Wayfare engine setup, update loop, entity creation, and system ordering.
- `src/physics.ts`: Matter engine setup, bodies, constraints, collisions, and helpers.
- `src/input.ts`: dual-zone joystick, swipe, hold, and mouse/pointer input.
- `src/rendering.ts`: rectangle mesh creation, material helpers, entity sync, and camera setup.
- `src/styles.css`: canvas and mobile landscape UI styling.

## Handoff Notes

The next agent should assume this is still prototype-grade and tune feel before adding production structure. The most useful next steps are:

- Playtest jump and fall feel after the latest gravity reduction. The user was actively tuning movement feel, so expect more iteration.
- Add mouse aiming or mouse-held grappling for desktop. Keyboard controls exist, but grappling is still only tap-and-hold on the right touch zone.
- Improve collision robustness if speeds keep increasing. Current velocity clamps and Matter solver iterations help, but this is not a full swept-collision platformer controller.
- Consider replacing ad hoc constants with a `PlayerTuning` object once movement settles.
- Add visible debug text or a hidden debug panel for velocity, grounded state, selected grapple point, and active action. This would make future tuning much faster.
- Decide whether the game logic should stay app-local or move into a shared `packages/cave-game-common` package if React Native or another runtime is planned.
- Revisit TypeScript verification once Wayfare's existing type errors are addressed.

Current changed files at handoff:

- New app directory: `apps/cave-game/`.
- Updated lockfile: `pnpm-lock.yaml`.
