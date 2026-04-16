/**
 * Physarum polycephalum simulation based on Jeff Jones' agent-based model (2010).
 *
 * The model uses many simple agents that:
 *   1. Sense chemoattractant on a trail map via 3 forward sensors
 *   2. Rotate toward the strongest signal
 *   3. Step forward and deposit trail
 *
 * The trail map diffuses and decays each tick, creating emergent network
 * structures that mimic real slime mold behavior: foraging, network
 * optimization between food sources, and path-finding.
 */

const TWO_PI = Math.PI * 2

/** Tunable behavioral parameters for the simulation */
export interface PhysarumOptions {
  /** Sensor angle in radians (SA). Default 22.5° (Jones 2010). */
  sensorAngle?: number
  /** Rotation angle in radians (RA). Default 45°. */
  rotationAngle?: number
  /** Sensor offset distance in cells (SO). Default 5. */
  sensorDistance?: number
  /** Movement speed in cells per tick (SS). Default 1. */
  stepSize?: number
  /** Chemoattractant deposited per agent step. Default 5. */
  depositAmount?: number
  /** Trail decay multiplier per tick (0–1). Default 0.9. */
  decayFactor?: number
  /** Diffusion kernel radius. Default 1 (3x3). */
  diffuseKernel?: number
  /** Maximum agent population. Default 2000. */
  maxAgents?: number
  /** Chemoattractant emitted by food per tick. Default 60. */
  foodDepositAmount?: number
  /** Radius of food chemoattractant spread in cells. Default 3. */
  foodSpreadRadius?: number
  /** Weight of extracellular slime avoidance (0–1). Default 0.3. */
  slimeAvoidanceWeight?: number
  /** Energy lost per tick from starvation. Default 0.0002. */
  starveRate?: number
  /** Energy gained per tick for agents adjacent to food. Default 0.02. */
  feedRate?: number
  /** Food mass consumed per tick per feeding agent. Default 0.003. */
  massLossRate?: number
  /** Energy threshold above which agents can divide. Default 1.5. */
  divisionThreshold?: number
  /** Per-tick probability of division when eligible. Default 0.03. */
  divisionChance?: number
  /** Cap on per-agent energy. Default 2.0. */
  maxEnergy?: number
  /** Starting mass for new food pellets. Default 5.0. */
  defaultFoodMass?: number
}

/** A grid position */
export interface GridPos {
  x: number
  y: number
}

/** A food source with consumable mass */
export interface FoodSource {
  x: number
  y: number
  /** Remaining mass (0–1). Food is removed when depleted. */
  mass: number
  /** Initial mass used for visual scaling. */
  initialMass: number
}

/** A voxel cell returned by getActiveCells for rendering */
export interface SlimeCell {
  x: number
  y: number
  /**
   * Trail concentration (0–1). Higher = thicker tube.
   * Controls voxel stack height.
   */
  density: number
  /**
   * Agent activity recency (0–1).
   * 1.0 = agent currently present (leading edge / active flow).
   * 0.5 = established body, recent traffic.
   * Low = slime was here but is retracting / being reabsorbed.
   * Controls voxel brightness.
   */
  recency: number
  /** Voxel stack height (1–3) derived from density */
  height: number
}

/** A chemoattractant gradient cell for rendering the food "scent" */
export interface ChemoCell {
  x: number
  y: number
  /** Normalized food-scent intensity (0–1) */
  intensity: number
}

export class PhysarumSim {
  readonly width: number
  readonly height: number

  // Behavioral parameters (mutable for live tuning)
  sensorAngle: number
  rotationAngle: number
  sensorDistance: number
  stepSize: number
  depositAmount: number
  decayFactor: number
  diffuseKernel: number
  maxAgents: number
  foodDepositAmount: number
  foodSpreadRadius: number
  slimeAvoidanceWeight: number

  // Biomass dynamics (feeding → growth, absence of food → starvation)
  starveRate: number
  feedRate: number
  massLossRate: number
  divisionThreshold: number
  divisionChance: number
  maxEnergy: number
  defaultFoodMass: number

  // State
  trailMap: Float32Array
  trailMapB: Float32Array
  foodTrailMap: Float32Array
  foodTrailMapB: Float32Array
  occupancy: Uint8Array
  agentX: Float32Array
  agentY: Float32Array
  agentHeading: Float32Array
  /** Per-agent energy reserve (0–maxEnergy). Gained by eating, lost to starvation. */
  agentEnergy: Float32Array
  agentCount: number
  foodSources: FoodSource[]
  blocked: Uint8Array
  visitedTrail: Float32Array
  visitedDecay: number

  constructor(width: number, height: number, opts: PhysarumOptions = {}) {
    this.width = width
    this.height = height

    // Jones 2010 defaults, adapted for small grids
    this.sensorAngle = opts.sensorAngle ?? (Math.PI / 8)
    this.rotationAngle = opts.rotationAngle ?? Math.PI / 4
    this.sensorDistance = opts.sensorDistance ?? 5
    this.stepSize = opts.stepSize ?? 1
    this.depositAmount = opts.depositAmount ?? 5
    this.decayFactor = opts.decayFactor ?? 0.9
    this.diffuseKernel = opts.diffuseKernel ?? 1
    this.maxAgents = opts.maxAgents ?? 2000
    this.foodDepositAmount = opts.foodDepositAmount ?? 60
    this.foodSpreadRadius = opts.foodSpreadRadius ?? 3
    this.slimeAvoidanceWeight = opts.slimeAvoidanceWeight ?? 0.3

    // Biomass dynamics (see notes in _consumeFood / _starveAgents / _divideAgents)
    this.starveRate = opts.starveRate ?? 0.0002
    this.feedRate = opts.feedRate ?? 0.02
    this.massLossRate = opts.massLossRate ?? 0.003
    this.divisionThreshold = opts.divisionThreshold ?? 1.5
    this.divisionChance = opts.divisionChance ?? 0.03
    this.maxEnergy = opts.maxEnergy ?? 2.0
    this.defaultFoodMass = opts.defaultFoodMass ?? 5.0

    this.trailMap = new Float32Array(width * height)
    this.trailMapB = new Float32Array(width * height)
    this.foodTrailMap = new Float32Array(width * height)
    this.foodTrailMapB = new Float32Array(width * height)
    this.occupancy = new Uint8Array(width * height)

    this.agentX = new Float32Array(this.maxAgents)
    this.agentY = new Float32Array(this.maxAgents)
    this.agentHeading = new Float32Array(this.maxAgents)
    this.agentEnergy = new Float32Array(this.maxAgents)
    this.agentCount = 0

    this.foodSources = []
    this.blocked = new Uint8Array(width * height)
    this.visitedTrail = new Float32Array(width * height)
    // 0.99 → a cell visited once at max intensity fades to invisible
    // in ~460 ticks (~23 seconds at 1x speed). Biologically this
    // represents the plasmodium retracting from abandoned paths.
    this.visitedDecay = 0.99
  }

  setBlocked(x: number, y: number, val: number = 1): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.blocked[y * this.width + x] = val
    }
  }

  loadMaze(mazeGrid: number[][]): void {
    for (let y = 0; y < mazeGrid.length && y < this.height; y++) {
      for (let x = 0; x < mazeGrid[y].length && x < this.width; x++) {
        this.blocked[y * this.width + x] = mazeGrid[y][x] ? 1 : 0
      }
    }
  }

  addFood(x: number, y: number, mass: number = this.defaultFoodMass): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.foodSources.push({ x, y, mass, initialMass: mass })
    }
  }

  removeFood(x: number, y: number, radius: number = 2): void {
    this.foodSources = this.foodSources.filter(
      f => Math.abs(f.x - x) > radius || Math.abs(f.y - y) > radius
    )
  }

  seedAgents(cx: number, cy: number, count: number, radius: number = 5): void {
    for (let i = 0; i < count && this.agentCount < this.maxAgents; i++) {
      const angle = Math.random() * TWO_PI
      const r = Math.random() * radius
      const x = cx + Math.cos(angle) * r
      const y = cy + Math.sin(angle) * r
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) continue
      const idx = Math.floor(y) * this.width + Math.floor(x)
      if (this.blocked[idx]) continue

      const ai = this.agentCount++
      this.agentX[ai] = x
      this.agentY[ai] = y
      this.agentHeading[ai] = Math.random() * TWO_PI
      this.agentEnergy[ai] = 1.0
    }
  }

  private _sampleMap(map: Float32Array, x: number, y: number): number {
    const ix = Math.floor(x)
    const iy = Math.floor(y)
    if (ix < 0 || ix >= this.width - 1 || iy < 0 || iy >= this.height - 1) return 0
    const fx = x - ix
    const fy = y - iy
    const w = this.width
    return (
      map[iy * w + ix] * (1 - fx) * (1 - fy) +
      map[iy * w + ix + 1] * fx * (1 - fy) +
      map[(iy + 1) * w + ix] * (1 - fx) * fy +
      map[(iy + 1) * w + ix + 1] * fx * fy
    )
  }

  sampleTrail(x: number, y: number): number {
    const trail = this._sampleMap(this.trailMap, x, y)
    const visited = this._sampleMap(this.visitedTrail, x, y)
    return trail - visited * this.slimeAvoidanceWeight
  }

  step(): void {
    this._emitFood()
    this._moveAgents()
    this._consumeFood()    // agents adjacent to food gain energy, food loses mass
    this._starveAgents()   // all agents lose energy; dead ones removed
    this._divideAgents()   // well-fed agents can split into new adjacent agents
    this._diffuseTrail()
    this._decayTrail()
    this._reinforceNetwork()
  }

  private _emitFood(): void {
    const w = this.width
    const h = this.height
    const r = this.foodSpreadRadius
    for (const food of this.foodSources) {
      // Emission strength scales with remaining mass
      const strength = this.foodDepositAmount * food.mass
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = food.x + dx
          const ny = food.y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          if (this.blocked[ny * w + nx]) continue
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= r) {
            const falloff = 1 - dist / (r + 1)
            const amount = strength * falloff
            this.trailMap[ny * w + nx] += amount
            this.foodTrailMap[ny * w + nx] += amount
          }
        }
      }
    }
  }

  /**
   * Consume food mass based on nearby slime mold presence.
   * The more agents near a food source, the faster it's consumed.
   * Food is removed when its mass is depleted.
   */
  /**
   * Agents adjacent to food "eat" it: they gain energy, and the food loses
   * mass. Each agent can only feed from one food source per tick (the
   * nearest available one), so food is depleted proportionally to the
   * number of agents physically touching it.
   */
  private _consumeFood(): void {
    if (this.foodSources.length === 0) return
    const consumeRadius = 1.8
    const consumeR2 = consumeRadius * consumeRadius

    for (let i = 0; i < this.agentCount; i++) {
      const ax = this.agentX[i]
      const ay = this.agentY[i]

      // Find the closest food source this agent is adjacent to
      let bestFood: FoodSource | null = null
      let bestD2 = consumeR2
      for (const food of this.foodSources) {
        if (food.mass <= 0) continue
        const dx = ax - food.x
        const dy = ay - food.y
        const d2 = dx * dx + dy * dy
        if (d2 <= bestD2) {
          bestD2 = d2
          bestFood = food
        }
      }

      if (bestFood === null) continue

      // Eat: gain energy (capped), food loses mass
      const consumed = Math.min(this.massLossRate, bestFood.mass)
      bestFood.mass -= consumed
      this.agentEnergy[i] = Math.min(
        this.agentEnergy[i] + this.feedRate,
        this.maxEnergy
      )
    }

    // Remove fully consumed food
    this.foodSources = this.foodSources.filter(f => f.mass > 0.02)
  }

  /**
   * Agents lose a bit of energy every tick. Agents that run out starve
   * and are removed from the population via swap-and-pop.
   */
  private _starveAgents(): void {
    const sr = this.starveRate
    for (let i = 0; i < this.agentCount; ) {
      this.agentEnergy[i] -= sr
      if (this.agentEnergy[i] <= 0) {
        // Swap-pop death: move last agent into this slot, shrink count
        const last = --this.agentCount
        if (i !== last) {
          this.agentX[i] = this.agentX[last]
          this.agentY[i] = this.agentY[last]
          this.agentHeading[i] = this.agentHeading[last]
          this.agentEnergy[i] = this.agentEnergy[last]
        }
        // Re-check slot i (now holds a different agent)
      } else {
        i++
      }
    }
  }

  /**
   * Well-fed agents can split into two. The parent stays in place and the
   * child appears in a random adjacent unoccupied cell. Both resulting
   * agents get half of the parent's pre-division energy, so biomass
   * growth happens only at the expense of stored energy (which came from
   * feeding).
   */
  private _divideAgents(): void {
    if (this.agentCount >= this.maxAgents) return
    const w = this.width
    const h = this.height
    const threshold = this.divisionThreshold
    const chance = this.divisionChance

    // Iterate a snapshot of the current count — children shouldn't immediately
    // divide in the same tick.
    const initialCount = this.agentCount
    for (let i = 0; i < initialCount; i++) {
      if (this.agentCount >= this.maxAgents) break
      if (this.agentEnergy[i] < threshold) continue
      if (Math.random() > chance) continue

      const px = Math.floor(this.agentX[i])
      const py = Math.floor(this.agentY[i])

      // Try a random adjacent cell
      const dx = ((Math.random() * 3) | 0) - 1
      const dy = ((Math.random() * 3) | 0) - 1
      if (dx === 0 && dy === 0) continue
      const nx = px + dx
      const ny = py + dy
      if (nx < 1 || nx >= w - 1 || ny < 1 || ny >= h - 1) continue
      const idx = ny * w + nx
      if (this.blocked[idx] || this.occupancy[idx]) continue

      // Spawn child, split energy
      const ai = this.agentCount++
      this.agentX[ai] = nx + 0.5
      this.agentY[ai] = ny + 0.5
      this.agentHeading[ai] = Math.random() * TWO_PI
      const half = this.agentEnergy[i] / 2
      this.agentEnergy[i] = half
      this.agentEnergy[ai] = half
      this.occupancy[idx] = 1
    }
  }

  private _moveAgents(): void {
    const { sensorAngle: SA, rotationAngle: RA, sensorDistance: SO,
            stepSize: SS, depositAmount: DA, width: w, height: h } = this

    this.occupancy.fill(0)
    for (let i = 0; i < this.agentCount; i++) {
      const ix = Math.floor(this.agentX[i])
      const iy = Math.floor(this.agentY[i])
      if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
        this.occupancy[iy * w + ix] = 1
      }
    }

    for (let i = 0; i < this.agentCount; i++) {
      const x = this.agentX[i]
      const y = this.agentY[i]
      const heading = this.agentHeading[i]

      const fL = this.sampleTrail(
        x + Math.cos(heading + SA) * SO,
        y + Math.sin(heading + SA) * SO
      )
      const fC = this.sampleTrail(
        x + Math.cos(heading) * SO,
        y + Math.sin(heading) * SO
      )
      const fR = this.sampleTrail(
        x + Math.cos(heading - SA) * SO,
        y + Math.sin(heading - SA) * SO
      )

      let newHeading = heading
      if (fC > fL && fC > fR) {
        // straight
      } else if (fC < fL && fC < fR) {
        newHeading += (Math.random() < 0.5 ? RA : -RA)
      } else if (fL > fR) {
        newHeading += RA
      } else if (fR > fL) {
        newHeading -= RA
      } else {
        newHeading += (Math.random() - 0.5) * RA * 0.5
      }

      newHeading = ((newHeading % TWO_PI) + TWO_PI) % TWO_PI
      this.agentHeading[i] = newHeading

      const nx = x + Math.cos(newHeading) * SS
      const ny = y + Math.sin(newHeading) * SS
      const nix = Math.floor(nx)
      const niy = Math.floor(ny)

      if (nix >= 1 && nix < w - 1 && niy >= 1 && niy < h - 1 &&
          !this.blocked[niy * w + nix] &&
          !this.occupancy[niy * w + nix]) {
        const oix = Math.floor(x)
        const oiy = Math.floor(y)
        if (oix >= 0 && oix < w && oiy >= 0 && oiy < h) {
          this.occupancy[oiy * w + oix] = 0
        }
        this.agentX[i] = nx
        this.agentY[i] = ny
        this.occupancy[niy * w + nix] = 1
        this.trailMap[niy * w + nix] += DA
        this.visitedTrail[niy * w + nix] = Math.min(
          this.visitedTrail[niy * w + nix] + 0.1, 1.0
        )
      } else {
        this.agentHeading[i] = Math.random() * TWO_PI
      }
    }
  }

  /** Wall-aware 3x3 mean filter on a Float32Array pair, swaps in place. */
  private _diffuseMap(src: Float32Array, dst: Float32Array): { out: Float32Array, buf: Float32Array } {
    const w = this.width
    const h = this.height
    const blocked = this.blocked

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        if (blocked[idx]) {
          dst[idx] = 0
          continue
        }
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = (y + dy) * w + (x + dx)
            if (!blocked[nIdx]) {
              sum += src[nIdx]
              count++
            }
          }
        }
        dst[idx] = count > 0 ? sum / count : 0
      }
    }
    return { out: dst, buf: src }
  }

  private _diffuseTrail(): void {
    const main = this._diffuseMap(this.trailMap, this.trailMapB)
    this.trailMap = main.out
    this.trailMapB = main.buf

    const food = this._diffuseMap(this.foodTrailMap, this.foodTrailMapB)
    this.foodTrailMap = food.out
    this.foodTrailMapB = food.buf
  }

  private _decayTrail(): void {
    const t = this.trailMap
    const ft = this.foodTrailMap
    const df = this.decayFactor
    const blocked = this.blocked
    for (let i = 0; i < t.length; i++) {
      if (blocked[i]) { t[i] = 0; ft[i] = 0; continue }
      t[i] *= df
      if (t[i] < 0.01) t[i] = 0
      ft[i] *= df
      if (ft[i] < 0.01) ft[i] = 0
    }
    const v = this.visitedTrail
    const vd = this.visitedDecay
    for (let i = 0; i < v.length; i++) {
      v[i] *= vd
    }
  }

  private _reinforceNetwork(): void {
    const w = this.width
    const h = this.height
    const t = this.trailMap

    for (let i = 0; i < this.agentCount; i++) {
      const ax = Math.floor(this.agentX[i])
      const ay = Math.floor(this.agentY[i])
      if (ax < 1 || ax >= w - 1 || ay < 1 || ay >= h - 1) continue

      let neighbors = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (this.occupancy[(ay + dy) * w + (ax + dx)]) neighbors++
        }
      }

      if (neighbors >= 2) {
        t[ay * w + ax] += neighbors * 0.3
      }
    }
  }

  getDensityGrid(): Float32Array {
    const grid = new Float32Array(this.width * this.height)
    const t = this.trailMap

    let maxVal = 1
    for (let i = 0; i < t.length; i++) {
      if (t[i] > maxVal) maxVal = t[i]
    }
    for (let i = 0; i < t.length; i++) {
      grid[i] = Math.min(t[i] / (maxVal * 0.3), 1.0)
    }
    return grid
  }

  /**
   * Returns cells to render as slime voxels. Each cell carries two
   * independent signals:
   *
   *   density = trailMap strength → how thick the tube is (voxel height)
   *   recency = visitedTrail + occupancy → how active the cell is (brightness)
   *
   * A cell renders if either (a) an agent is currently there, or
   * (b) an agent visited recently enough that visitedTrail is still
   * above `recencyThreshold`. This means fading/retracting slime
   * still renders — just dim — so you can see the organism shrinking.
   */
  getActiveCells(recencyThreshold: number = 0.05): SlimeCell[] {
    const cells: SlimeCell[] = []
    const w = this.width
    const h = this.height
    const t = this.trailMap
    const v = this.visitedTrail
    const occ = this.occupancy

    // Normalize trail density against the grid's current max
    let maxTrail = 1
    for (let i = 0; i < t.length; i++) {
      if (t[i] > maxTrail) maxTrail = t[i]
    }
    const trailNorm = maxTrail * 0.15

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (this.blocked[idx]) continue

        const vt = v[idx]
        const hasAgent = occ[idx] === 1

        // Must be either agent-present or recently-visited (visitedTrail
        // is only written by agent movement, so food emission never
        // triggers false positives here).
        if (!hasAgent && vt < recencyThreshold) continue

        // Agents get max recency; otherwise fall off with visitedTrail
        const recency = hasAgent ? 1.0 : Math.min(vt, 1.0)
        // Tube density from chemical trail concentration
        const density = Math.min(t[idx] / trailNorm, 1.0)

        cells.push({
          x, y,
          density,
          recency,
          // Minimum height 1 so even faded cells are visible as thin voxels
          height: Math.max(1, Math.min(Math.floor(density * 3) + 1, 3)),
        })
      }
    }
    return cells
  }

  /**
   * Get cells where food chemoattractant is present but slime has NOT
   * yet reached — the visible "scent frontier" spreading from food.
   */
  getChemoGradientCells(threshold: number = 0.05): ChemoCell[] {
    const cells: ChemoCell[] = []
    const w = this.width
    const h = this.height
    const ft = this.foodTrailMap

    let maxVal = 1
    for (let i = 0; i < ft.length; i++) {
      if (ft[i] > maxVal) maxVal = ft[i]
    }

    const normFactor = maxVal * 0.2
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x
        if (this.blocked[idx]) continue
        // Only show where slime has NOT been — the unexplored scent
        if (this.visitedTrail[idx] > 0.01) continue
        const val = ft[idx] / normFactor
        if (val > threshold) {
          cells.push({
            x, y,
            intensity: Math.min(val, 1.0),
          })
        }
      }
    }
    return cells
  }
}
