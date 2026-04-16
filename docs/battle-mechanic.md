# Slime Mold Battle Mechanic — Design Plan

## Biology background: how Physarum species compete

Real slime molds have several documented mechanisms for dealing with competitors:

1. **Fusion vs. rejection (somatic compatibility)** — When two plasmodia of the *same species* meet, their behavior depends on genetic compatibility. Compatible strains **fuse** into one larger organism (cytoplasm merges). Incompatible strains form a **somatic incompatibility barrier** — a narrow dark line of dying cells where the two plasmodia contact each other. Neither side crosses.

2. **Extracellular slime as territory marker** — The thick mucopolysaccharide slime trail a plasmodium leaves behind is not neutral: other plasmodia (same species or different) can sense it and tend to avoid heavily-slimed areas, because it signals "this territory is claimed and there are no fresh resources here."

3. **Allelochemistry (chemical warfare)** — Some Physarum species secrete **secondary metabolites** (small molecules) that damage or inhibit growth of competing fungi and other microorganisms. Polycephalin B, physarigin, and related compounds have been characterized. Sustained exposure thins the opponent's cytoplasm at the contact front.

4. **Resource competition** — Even without direct contact, the faster/bigger organism reaches food first and consumes it before competitors can. An organism with a more exploratory sensor configuration finds food sooner; one with a more aggressive tube reinforcement pattern consolidates around it faster.

5. **Engulfment (rare)** — A large healthy plasmodium that meets a much smaller weakened one of the same species can sometimes engulf and digest it. Uncommon but documented.

## Game design

We'll add a **"Battle Mode"** that runs two slime molds simultaneously in the same terrarium. Each slime has its own name, color, and full behavioral parameter set. The player can switch which slime they're editing at any time.

### Core mechanics (MVP)

1. **Team-tagged agents**
   Each agent gets a `team: 0 | 1` field. Two slimes means the single existing agent-pool array gets partitioned — agents of team 0 and team 1 live together but are distinguishable.

2. **Separate visitedTrail per team**
   `visitedTrailA: Float32Array`, `visitedTrailB: Float32Array` — each team only writes to its own map. This lets us implement territory marking independently.

3. **Chemotaxis with territory penalty**
   When an agent samples the trail map at a sensor position, subtract a **repulsion term** for the enemy's visited trail at that point:

   ```
   effectiveTrail(x,y) = trailMap(x,y)
                      − myTeamAvoidance   * myVisitedTrail(x,y)
                      − enemyRepulsion    * enemyVisitedTrail(x,y)
   ```

   Both teams are still attracted to the chemoattractant (food scent), but they're repelled by each other's slime. This naturally produces **boundary formation** — neither side wants to walk into the other's territory, so they meet at a frontier and stop.

4. **Combat at the frontier**
   When an agent's cell has an enemy agent in one of the 8 neighboring cells, both take damage:

   ```
   self.energy     -= combatDamage * attackStrengthEnemy
   enemy.energy    -= combatDamage * attackStrengthSelf
   ```

   `attackStrength` is a per-team parameter (e.g. 1.0 default, tunable). Whoever runs out of energy first dies (reuses existing `_starveAgents` swap-pop death logic).

5. **Resource competition emerges for free**
   Both teams compete for the same food pool. The faster/better explorer consumes food first, denying it to the opponent. No special code needed — the existing `_consumeFood` just needs to not care about team when agents feed.

6. **Win conditions**
   - **Extinction**: one team's agent count reaches 0 → game over, survivor wins
   - **Domination**: one team covers ≥80% of non-wall cells for ≥30 seconds → early win
   - **Stalemate**: both teams stable at >0 agents with a stable boundary for ≥60 seconds → tie

### Data-model changes (concrete)

**`PhysarumSim.ts`:**
- Add `agentTeam: Uint8Array` (0 or 1) parallel to `agentX/Y/Heading/Energy`.
- Split `visitedTrail` → `visitedTrailByTeam: [Float32Array, Float32Array]`.
- Per-team tunable parameters:
  - `sensorAngleByTeam: [number, number]`
  - `rotationAngleByTeam: [number, number]`
  - `sensorDistanceByTeam: [number, number]`
  - `depositAmountByTeam: [number, number]`
  - `decayFactor` stays global (same environment decay)
  - `slimeAvoidanceByTeam: [number, number]`  (own-slime avoidance, existing)
  - `enemyRepulsionByTeam: [number, number]`  (new — how strongly to avoid enemy territory)
  - `attackStrengthByTeam: [number, number]`  (new — combat damage multiplier)
- `sampleTrail` becomes `sampleTrail(x, y, team: 0|1)` — reads global trailMap, subtracts own and enemy visitedTrail weighted by team params.
- New method `seedAgents(cx, cy, count, radius, team)`.
- New method `_fightAdjacentEnemies()` called in `step()` — pairwise damage when agents of different teams are neighbors.
- `_starveAgents` unchanged (energy death works the same).

### Rendering changes

- `SlimeMoldMesh` becomes `SlimeMoldMesh` per team, each with its own color prop. In App, call `sim.getActiveCells(teamFilter: 0 | 1)` twice.
- At the battle frontier, cells will alternate team ownership tick-to-tick as agents push and pull — this naturally gives a visible "contested zone" shimmer.
- Optional: a thin red or grey voxel line on truly-dead boundary cells where a team's agents died recently, mimicking the dark rejection line in real biology.

### UI changes

- Top bar shows **both** slime names + agent counts, color-coded.
- A new mode toggle: "Solo" / "Battle".
- In Battle mode, the Behavior panel gets a team selector (e.g. two color swatches at the top of the panel) — clicking one selects which team's parameters you're editing.
- When a win condition triggers, a centered banner announces "Name wins!" with option to rematch (reset sim with same parameters) or start over.

### Implementation phases

**Phase 1 — Data layer.** Add `team` to agents, split visitedTrail, parameterize all behavioral values by team. Remove global behavioral params, replace with `params[team]`. Still works in solo mode (just use team 0).

**Phase 2 — Combat.** Add `enemyRepulsion` in the sensor pass, add `_fightAdjacentEnemies`. Test with two teams using identical params — should reach stalemate in the middle.

**Phase 3 — Rendering split.** Two slime meshes with different colors.

**Phase 4 — UI.** Solo/Battle toggle, team selector in the params panel, win banner.

**Phase 5 — Tuning.** Find parameter ranges where battles are *interesting* — a slime with high Sensor Range but low Deposit feels like a "scout" type; one with high Deposit and low Sensor Range feels like a "builder" type. Different archetypes should counter each other so matchups matter.

### Risks & open questions

- **Performance**: doubling agents + two visitedTrail maps + combat loop adds ~3x CPU per tick. On a 96x96 grid with 6000 agents we should still be fine, but worth measuring.
- **Frontier stability**: if combat damage is too low, agents push through each other; too high, they die instantly on contact. Needs tuning.
- **Combat pair-finding**: the naive O(N) check for each agent's neighbors is O(N * 8). For 6000 agents that's 48k lookups per tick. Manageable with the occupancy map we already maintain.
- **Balance**: with asymmetric parameters (team A has sensor distance 9, team B has 3), team A will find food much faster. Do we want to allow that imbalance, or clamp to roughly equal total "points" across params? Probably allow imbalance — that's the whole point of a battle game.
- **Should food stay shared, or should each team have "claimed" food?** Shared is simpler and more biologically accurate. Going with shared.
