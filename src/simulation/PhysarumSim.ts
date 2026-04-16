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
}

/** A grid position */
export interface GridPos {
  x: number
  y: number
}

/** A voxel cell returned by getActiveCells for rendering */
export interface SlimeCell {
  x: number
  y: number
  /** Normalized trail intensity (0–1) */
  intensity: number
  /** Voxel stack height (1–3) based on trail concentration */
  height: number
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

  // State
  trailMap: Float32Array
  trailMapB: Float32Array
  occupancy: Uint8Array
  agentX: Float32Array
  agentY: Float32Array
  agentHeading: Float32Array
  agentCount: number
  foodSources: GridPos[]
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

    this.trailMap = new Float32Array(width * height)
    this.trailMapB = new Float32Array(width * height)
    this.occupancy = new Uint8Array(width * height)

    this.agentX = new Float32Array(this.maxAgents)
    this.agentY = new Float32Array(this.maxAgents)
    this.agentHeading = new Float32Array(this.maxAgents)
    this.agentCount = 0

    this.foodSources = []
    this.blocked = new Uint8Array(width * height)
    this.visitedTrail = new Float32Array(width * height)
    this.visitedDecay = 0.999
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

  addFood(x: number, y: number): void {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.foodSources.push({ x, y })
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
    this._diffuseTrail()
    this._decayTrail()
    this._reinforceNetwork()
    this._growTowardFood()
  }

  private _emitFood(): void {
    const w = this.width
    const h = this.height
    const r = this.foodSpreadRadius
    for (const food of this.foodSources) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = food.x + dx
          const ny = food.y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          if (this.blocked[ny * w + nx]) continue
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= r) {
            const falloff = 1 - dist / (r + 1)
            this.trailMap[ny * w + nx] += this.foodDepositAmount * falloff
          }
        }
      }
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

  private _diffuseTrail(): void {
    const w = this.width
    const h = this.height
    const src = this.trailMap
    const dst = this.trailMapB
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

    this.trailMap = dst
    this.trailMapB = src
  }

  private _decayTrail(): void {
    const t = this.trailMap
    const df = this.decayFactor
    const blocked = this.blocked
    for (let i = 0; i < t.length; i++) {
      if (blocked[i]) { t[i] = 0; continue }
      t[i] *= df
      if (t[i] < 0.01) t[i] = 0
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

  private _growTowardFood(): void {
    if (this.agentCount >= this.maxAgents) return

    for (const food of this.foodSources) {
      const idx = food.y * this.width + food.x
      if (this.trailMap[idx] > 10 && Math.random() < 0.15) {
        const count = Math.min(3, this.maxAgents - this.agentCount)
        this.seedAgents(food.x, food.y, count, 2)
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

  getActiveCells(threshold: number = 0.08): SlimeCell[] {
    const cells: SlimeCell[] = []
    const w = this.width
    const h = this.height
    const t = this.trailMap

    let maxVal = 1
    for (let i = 0; i < t.length; i++) {
      if (t[i] > maxVal) maxVal = t[i]
    }

    const normFactor = maxVal * 0.15
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = t[y * w + x] / normFactor
        if (val > threshold && !this.blocked[y * w + x]) {
          cells.push({
            x, y,
            intensity: Math.min(val, 1.0),
            height: Math.min(Math.floor(val * 3) + 1, 3)
          })
        }
      }
    }
    return cells
  }
}
