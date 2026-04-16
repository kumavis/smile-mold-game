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

export class PhysarumSim {
  constructor(width, height, opts = {}) {
    this.width = width
    this.height = height

    // --- Simulation parameters (Jones 2010, adapted for 48x48 grid) ---
    // Jones' paper: SA=22.5°, RA=45°, SO=9 for large grids.
    // We scale SO down for our small grid, and use SA=22.5° for realistic
    // tight network formation (the organism follows existing trails closely).
    this.sensorAngle = opts.sensorAngle ?? (Math.PI / 8)        // SA: 22.5° (Jones default)
    this.rotationAngle = opts.rotationAngle ?? Math.PI / 4      // RA: 45°   (Jones default)
    this.sensorDistance = opts.sensorDistance ?? 5               // SO: scaled down from 9
    this.stepSize = opts.stepSize ?? 1                          // SS: 1 pixel per tick
    this.depositAmount = opts.depositAmount ?? 5                // chemo deposited per agent step
    this.decayFactor = opts.decayFactor ?? 0.9                  // Jones: decayT = 0.1 → multiply by 0.9
    this.diffuseKernel = opts.diffuseKernel ?? 1                // 3x3 mean filter
    this.maxAgents = opts.maxAgents ?? 2000
    this.foodDepositAmount = opts.foodDepositAmount ?? 60       // food chemoattractant emission
    this.foodSpreadRadius = opts.foodSpreadRadius ?? 3
    // Slime avoidance: real Physarum leaves extracellular slime it avoids
    this.slimeAvoidanceWeight = opts.slimeAvoidanceWeight ?? 0.3

    // --- State ---
    this.trailMap = new Float32Array(width * height)           // chemoattractant concentrations
    this.trailMapB = new Float32Array(width * height)          // double buffer for diffusion
    this.occupancy = new Uint8Array(width * height)            // 1 cell per agent max

    // Agents: parallel arrays for cache-friendly iteration
    this.agentX = new Float32Array(this.maxAgents)
    this.agentY = new Float32Array(this.maxAgents)
    this.agentHeading = new Float32Array(this.maxAgents)
    this.agentCount = 0

    // Food sources: [{x, y}]
    this.foodSources = []

    // Terrain mask: cells where slime cannot go (rocks, walls)
    this.blocked = new Uint8Array(width * height)

    // Track which cells have "ever been visited" for slime trail memory
    this.visitedTrail = new Float32Array(width * height)
    this.visitedDecay = 0.999
  }

  /** Mark a cell as blocked (terrain obstacle) */
  setBlocked(x, y, val = 1) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.blocked[y * this.width + x] = val
    }
  }

  /**
   * Load a maze from a 2D array of 0s and 1s (1 = wall).
   * The array is [row][col] where row = y, col = x.
   */
  loadMaze(mazeGrid) {
    for (let y = 0; y < mazeGrid.length && y < this.height; y++) {
      for (let x = 0; x < mazeGrid[y].length && x < this.width; x++) {
        this.blocked[y * this.width + x] = mazeGrid[y][x] ? 1 : 0
      }
    }
  }

  /** Add a food source at grid position */
  addFood(x, y) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.foodSources.push({ x, y })
    }
  }

  /** Remove food near a position */
  removeFood(x, y, radius = 2) {
    this.foodSources = this.foodSources.filter(
      f => Math.abs(f.x - x) > radius || Math.abs(f.y - y) > radius
    )
  }

  /** Seed agents in a cluster around a position */
  seedAgents(cx, cy, count, radius = 5) {
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

  /** Sample a float32 map with bilinear interpolation, clamped to bounds */
  _sampleMap(map, x, y) {
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

  /**
   * Sample effective attractiveness at a point.
   * Combines chemoattractant trail with avoidance of extracellular slime
   * (real Physarum leaves slime it avoids — externalized spatial memory,
   * Reid et al. 2012 PNAS).
   */
  sampleTrail(x, y) {
    const trail = this._sampleMap(this.trailMap, x, y)
    const visited = this._sampleMap(this.visitedTrail, x, y)
    return trail - visited * this.slimeAvoidanceWeight
  }

  /** One simulation tick */
  step() {
    this._emitFood()
    this._moveAgents()
    this._diffuseTrail()
    this._decayTrail()
    this._reinforceNetwork()
    this._growTowardFood()
  }

  /** Food sources continuously emit chemoattractant */
  _emitFood() {
    const w = this.width
    const h = this.height
    const r = this.foodSpreadRadius
    for (const food of this.foodSources) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = food.x + dx
          const ny = food.y + dy
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue
          if (this.blocked[ny * w + nx]) continue  // no emission into walls
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist <= r) {
            const falloff = 1 - dist / (r + 1)
            this.trailMap[ny * w + nx] += this.foodDepositAmount * falloff
          }
        }
      }
    }
  }

  /** Agent sensing, rotation, movement, and deposit */
  _moveAgents() {
    const { sensorAngle: SA, rotationAngle: RA, sensorDistance: SO,
            stepSize: SS, depositAmount: DA, width: w, height: h } = this

    // Clear occupancy
    this.occupancy.fill(0)
    // Mark current positions
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

      // --- SENSE ---
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

      // --- ROTATE ---
      let newHeading = heading
      if (fC > fL && fC > fR) {
        // Continue straight — strongest signal ahead
      } else if (fC < fL && fC < fR) {
        // Both sides stronger — pick randomly
        newHeading += (Math.random() < 0.5 ? RA : -RA)
      } else if (fL > fR) {
        newHeading += RA
      } else if (fR > fL) {
        newHeading -= RA
      } else {
        // All equal — add small random perturbation
        newHeading += (Math.random() - 0.5) * RA * 0.5
      }

      // Normalize heading
      newHeading = ((newHeading % TWO_PI) + TWO_PI) % TWO_PI
      this.agentHeading[i] = newHeading

      // --- MOVE ---
      const nx = x + Math.cos(newHeading) * SS
      const ny = y + Math.sin(newHeading) * SS

      const nix = Math.floor(nx)
      const niy = Math.floor(ny)

      // Boundary check + blocked check + occupancy check
      if (nix >= 1 && nix < w - 1 && niy >= 1 && niy < h - 1 &&
          !this.blocked[niy * w + nix] &&
          !this.occupancy[niy * w + nix]) {
        // Clear old occupancy
        const oix = Math.floor(x)
        const oiy = Math.floor(y)
        if (oix >= 0 && oix < w && oiy >= 0 && oiy < h) {
          this.occupancy[oiy * w + oix] = 0
        }
        // Move
        this.agentX[i] = nx
        this.agentY[i] = ny
        this.occupancy[niy * w + nix] = 1

        // --- DEPOSIT ---
        this.trailMap[niy * w + nix] += DA
        this.visitedTrail[niy * w + nix] = Math.min(
          this.visitedTrail[niy * w + nix] + 0.1, 1.0
        )
      } else {
        // Can't move — pick a new random heading
        this.agentHeading[i] = Math.random() * TWO_PI
      }
    }
  }

  /**
   * 3x3 mean filter diffusion, wall-aware.
   *
   * Critical for maze-solving: chemoattractant must NOT diffuse through
   * blocked cells (walls). In the real organism, chemical signals propagate
   * only through the plasmodium and surrounding medium, not through solid
   * barriers. Without this, the slime would "smell" food through walls
   * and maze-solving would fail.
   */
  _diffuseTrail() {
    const w = this.width
    const h = this.height
    const src = this.trailMap
    const dst = this.trailMapB
    const blocked = this.blocked

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x
        // Blocked cells don't participate in diffusion
        if (blocked[idx]) {
          dst[idx] = 0
          continue
        }
        let sum = 0
        let count = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nIdx = (y + dy) * w + (x + dx)
            // Only diffuse from non-blocked neighbors
            if (!blocked[nIdx]) {
              sum += src[nIdx]
              count++
            }
          }
        }
        dst[idx] = count > 0 ? sum / count : 0
      }
    }

    // Swap buffers
    this.trailMap = dst
    this.trailMapB = src
  }

  /** Decay trail values */
  _decayTrail() {
    const t = this.trailMap
    const df = this.decayFactor
    const blocked = this.blocked
    for (let i = 0; i < t.length; i++) {
      if (blocked[i]) { t[i] = 0; continue }
      t[i] *= df
      if (t[i] < 0.01) t[i] = 0
    }
    // Also decay visited trail slowly
    const v = this.visitedTrail
    const vd = this.visitedDecay
    for (let i = 0; i < v.length; i++) {
      v[i] *= vd
    }
  }

  /**
   * Network reinforcement inspired by Tero et al. (2007) adaptive dynamics.
   *
   * In real Physarum, tubes carrying higher cytoplasmic flux grow thicker
   * (actin-myosin cortex expands) while underused tubes shrink and are
   * reabsorbed. Mathematically: dD/dt = f(|Q|) - r*D.
   *
   * We approximate this by counting local agent density as a proxy for
   * "flux" and giving a small trail boost to high-traffic cells. This
   * creates the positive feedback loop that makes the organism converge
   * on shortest paths through mazes (Nakagaki et al. 2000 Nature).
   */
  _reinforceNetwork() {
    const w = this.width
    const h = this.height
    const t = this.trailMap

    // Count agent density per cell (proxy for cytoplasmic flux)
    // Cells with many nearby agents are part of active transport tubes
    for (let i = 0; i < this.agentCount; i++) {
      const ax = Math.floor(this.agentX[i])
      const ay = Math.floor(this.agentY[i])
      if (ax < 1 || ax >= w - 1 || ay < 1 || ay >= h - 1) continue

      // Count neighbors in 3x3
      let neighbors = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          if (this.occupancy[(ay + dy) * w + (ax + dx)]) neighbors++
        }
      }

      // High local density → reinforce trail (tube thickening)
      // This amplifies trails along busy routes and starves dead ends
      if (neighbors >= 2) {
        t[ay * w + ax] += neighbors * 0.3
      }
    }
  }

  /** Spontaneously spawn agents near food when slime has found it */
  _growTowardFood() {
    if (this.agentCount >= this.maxAgents) return

    for (const food of this.foodSources) {
      const idx = food.y * this.width + food.x
      // If there's significant trail at the food, the slime has "found" it
      // Spawn a few new agents to simulate growth
      if (this.trailMap[idx] > 10 && Math.random() < 0.15) {
        const count = Math.min(3, this.maxAgents - this.agentCount)
        this.seedAgents(food.x, food.y, count, 2)
      }
    }
  }

  /** Get a density grid suitable for rendering (0-1 normalized per cell) */
  getDensityGrid() {
    const w = this.width
    const h = this.height
    const grid = new Float32Array(w * h)
    const t = this.trailMap

    // Find max for normalization
    let maxVal = 1
    for (let i = 0; i < t.length; i++) {
      if (t[i] > maxVal) maxVal = t[i]
    }

    for (let i = 0; i < t.length; i++) {
      grid[i] = Math.min(t[i] / (maxVal * 0.3), 1.0)
    }
    return grid
  }

  /** Get active cells above a threshold for voxel rendering */
  getActiveCells(threshold = 0.08) {
    const cells = []
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
            // Height based on concentration: thicker where more trail
            height: Math.min(Math.floor(val * 3) + 1, 3)
          })
        }
      }
    }
    return cells
  }
}
