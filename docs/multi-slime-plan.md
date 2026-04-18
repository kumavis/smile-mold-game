# Multi-Slime, Tools, and Battle — Implementation Plan

Scope: extend the single-slime terrarium to support multiple coexisting slime
molds, a horizontal tool palette, a vertical slime roster, optional random
food drops, a pet interaction with sound + ripples, and a lightweight battle
mechanic that only activates when ≥2 slimes have living agents. Battle is a
side attraction — default 1-slime play must feel identical to today.

---

## 1. Simulation refactor (`PhysarumSim.ts`)

### New concepts

- **Team**: one record per slime species on the grid. Holds the id, visible
  name, colour, per-team behavioural parameters (sensorAngle, rotationAngle,
  sensorDistance, depositAmount, decayFactor, slimeAvoidanceWeight), a
  per-team `visitedTrail: Float32Array`, a live `agentCount`, and a rolling
  `populationHistory: number[]` sampled each tick (capped length ~600).
- **Per-agent team id**: new `agentTeam: Uint8Array` parallel to
  `agentX/agentY/agentHeading/agentEnergy`. Teams are indexed 0..N-1; 0 is
  the default "solo" team used by existing tests and single-player mode.
- **Occupancy encodes team**: `occupancy[idx]` now stores `teamId+1`
  (0 = empty). Lets `_moveAgents` and `_fightAdjacentEnemies` distinguish
  friendly vs enemy cells in O(1).
- **Chemo and trail maps stay shared** (one `trailMap` + one `foodTrailMap`).
  Species differentiation comes from the per-team `visitedTrail` used as a
  repulsion/memory signal — cheap and keeps the field-scale behaviour
  identical to Jones 2010 for the single-team case.
- **User walls**: new `userWalls: Uint8Array` distinct from `blocked`
  (terrain walls). The wall tool toggles cells here; `blocked` is recomputed
  as `terrainBlocked | userWalls` into a combined `blockedAll` mask used by
  diffusion/movement. Keeps terrain regeneration and user edits independent.
- **Decorations**: simple `decorations: { type: 'rock' | 'log', x, y }[]`
  stored on the sim so Scene can render them. Rocks block; logs don't but
  slightly slow agents (optional — start with "log = decorative only").
- **Random food drops**: optional `randomFoodDropInterval` + tick counter.
  Each drop picks a random non-blocked cell and calls `addFood`.

### API changes (additive, backward-compatible)

- `addTeam({ id, name, color, params }) → Team`
- `removeTeam(id)`: also removes that team's agents via swap-pop.
- `seedAgents(cx, cy, count, radius, teamId = 0)`:
  if no team exists yet, auto-creates `team[0]` with default params — this is
  what the maze test relies on. Backward-compat preserved.
- `sampleTrail(x, y, teamId)` / `_moveAgents` now subtract:
  `ownVisited * slimeAvoidanceWeight + sum(enemyVisited) * enemyRepulsionWeight`.
  For single-team, enemy sum is zero → behaviour unchanged.
- `addUserWall(x, y)`, `removeUserWall(x, y)`, `rebuildBlockedMask()`.
- `addDecoration(type, x, y)`, `removeDecoration(x, y)`.
- `getActiveCells(teamId?)`: when a team is provided, returns only that
  team's slime for per-team rendering (needed to colour each team
  independently without an O(N×cells) per-cell team lookup).
- `samplePopulations()`: pushes current per-team counts into each team's
  history; called at end of `step()`.
- Export helper `randomTeamParams()` → randomized `PhysarumOptions` subset.

### Combat — only active when ≥2 teams have agents

- New private `_fightAdjacentEnemies()` called inside `step()` after
  `_moveAgents`. Early-out if `teamsWithAgents < 2` — zero cost in solo play.
- Each agent checks its 4 neighbours; any neighbour occupied by a different
  team loses a small amount of energy (damage scales with attacker's
  depositAmount vs defender's). Dying agents get swap-popped normally.
- No win screen, no announcements — just population overtaking, visible in
  the timeseries.

### Preserving tests

- `PhysarumSim.maze.test.ts` uses `sim.addFood`, `sim.seedAgents(x,y,n,r)`,
  `sim.loadMaze()`, `sim.trailMap`, `sim.blocked`. All still present.
  `seedAgents` without explicit `teamId` must auto-create team 0.
- Combat must not fire for single-team mazes (the 2-team guard handles it).

---

## 2. App state refactor (`App.tsx`)

- Replace flat slime-name/color/params state with `slimes: SlimeState[]` and
  `selectedSlimeId: string`. Each SlimeState carries the same fields as
  today's `SlimeCustomization` plus `id` and `seedPos: {x,y}`.
- Default: one slime with the existing DEFAULTS so returning users see no
  change.
- `addSlime()`: pushes a new slime with randomized params
  (`randomTeamParams`) and a random name from a short flavour list, spawns
  at a random non-blocked cell. Newly-added teams must call `sim.addTeam`
  and `sim.seedAgents(cx, cy, count, radius, teamId)`.
- `removeSlime(id)` (from the roster UI, long-press or a small × on hover).
- `selectedSlime` drives the customization panel and the agent/pet tools.
- `regenerateTerrain`: rebuilds sim, then re-adds every slime team with
  random new `seedPos`es and re-seeds agents for each.
- LocalStorage key migration: if the stored value is the old
  `SlimeCustomization` shape, wrap it into `{ slimes: [that], selectedId }`.
- New tool state: `currentTool: 'food' | 'agent' | 'wall' | 'rock' | 'log' | 'pet'`.
  Default `food`.
- New setting: `randomFoodDrops: boolean` and `randomFoodInterval: number`.

---

## 3. UI components

### `SlimeList` (new, fixed left)

- Vertical column of circular icons (filled with the slime's colour,
  initial letter overlay). Selected slime gets a ring highlight. Terminates
  in a `+` button. Click = select; `+` = add a new random slime.
- Hovering shows name + agent count; right-click/long-press shows a
  remove option (skipped if only 1 slime left).

### `ToolBar` (new, top centre horizontal)

Labels + icons, left-to-right:

1. Food (default selected)
2. Add Agents (for the selected slime)
3. Wall (paint/erase user walls; shift to erase)
4. Rock decoration
5. Mossy Log decoration
6. Pet

Selected tool gets the existing `activeButtonStyle`. Tooltips describe
shift-modifiers (e.g. shift-tap to remove walls / food / decorations).

### `PopulationChart` (new, bottom-centre above instructions)

Small sparkline SVG per team (stacked or overlaid lines). Uses each team's
`populationHistory`. Width ~360px, height ~60px.

### `UI.tsx` customization panel

- Keep existing control panel but re-wire its values to the *selected*
  slime's fields. Slime name/colour/behaviour sliders now edit that slime's
  entry in the slimes array.
- Move the "Terrarium Controls" panel down/right a little so the slime
  roster has the top-left for its column.
- New toggle: "Random food drops" + speed slider.

---

## 4. Scene / interaction

- `Scene.tsx` currently dispatches to `onPlaceFood` / `onRemoveFood`. Replace
  with a single `onToolUse(x, z, shift)` callback; App routes based on
  `currentTool`.
- Pet tool: trigger a short ripple animation centred at the tap point
  (expanding flat ring, 0.3s) and a synthesized "squish" (Web Audio:
  short low-pitched sine with fast pitch drop + lowpass filter).
- New meshes:
  - `UserWallMesh`: voxels where `userWalls[idx] = 1`, neutral grey.
  - `DecorationMesh`: rocks (irregular grey boxes) and logs (brown,
    elongated). Placed at surface height.
  - `RippleEffect`: shader-cheap expanding ring (single transparent
    `ringGeometry` scaled over time).

### Per-slime slime rendering

- Render one `SlimeMoldMesh` per slime team (currently one). Each call to
  `sim.getActiveCells(teamId)` yields that team's cells; colour comes from
  the slime's configured colour. Cheap enough for 2–4 teams at grid 96².

---

## 5. Audio (pet tool)

- Lazy-initialize a single `AudioContext` on first user gesture.
- Squish = `OscillatorNode` (sine, freq 180→60 Hz over 0.08s) into a
  `BiquadFilter` (lowpass, 800Hz) with gain envelope 0→0.6→0 over 0.12s.
- No external assets, deploys cleanly to GH Pages.

---

## 6. Phasing / commit boundaries

1. **Sim refactor + tests still green**: add Team, agentTeam, per-team
   visitedTrail, combat gate, userWalls/decorations, random food drops,
   population history. Maze test must pass untouched.
2. **App state + SlimeList + ToolBar scaffolding**: wire selection, add
   slime, remove slime, tool switching. No new meshes yet; Food tool still
   works.
3. **New meshes**: walls, decorations, per-team slime rendering, ripple.
4. **Pet audio + ripple**: hook pet tool end-to-end.
5. **PopulationChart**: draw from team history.
6. **Polish**: localStorage migration, default-selection UX, mobile sizing.

Commit after each phase; push to `claude/slime-mold-game-FKI3M`.

---

## 7. Non-goals / explicit constraints

- No win screens, no end-of-match summaries. Battle is observational.
- Battle must not alter solo-play behaviour (guarded by `teamsWithAgents ≥ 2`).
- No new deps — Web Audio + Three.js + React only.
- Defer: team-tagged chemoattractant (separate foodTrailMap per team) —
  shared map is cheaper and still allows meaningful competition via
  visitedTrail repulsion.
