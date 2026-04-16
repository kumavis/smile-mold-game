import { describe, it, expect } from 'vitest'
import { PhysarumSim } from './PhysarumSim.ts'

/**
 * Maze-solving test for the Physarum simulation.
 *
 * This replicates the classic Nakagaki et al. (2000) experiment:
 * a slime mold placed at the entrance of a maze with food at key points
 * will extend through the corridors, find food, then consolidate its
 * network along the shortest paths — pruning dead-end branches.
 *
 * The mechanism:
 *   1. Food emits chemoattractant that diffuses through open corridors
 *   2. Agents follow the gradient toward food (chemotaxis)
 *   3. Agents deposit trail as they move, creating positive feedback
 *      on popular routes (tube reinforcement, Tero et al. 2007)
 *   4. Trail in dead ends decays because no food sustains it
 *   5. Extracellular slime avoidance prevents re-entering dead ends
 *   6. Result: the slime converges on the shortest path(s) through the maze
 */

// W = wall (1), . = open (0)
// A small 20x20 maze with:
//   - Start (S) at top-left: (2, 1)
//   - Middle food (M) at corridor junction: (10, 9)
//   - End food (E) at bottom-right: (17, 18)
//   - Dead-end branches that should be pruned
//   - One primary path from S → M → E

// prettier-ignore
const MAZE = [
// x: 0  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 19
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=0
  [ 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=1  S at (1,1)
  [ 1, 0, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=2
  [ 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1 ], // y=3
  [ 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1 ], // y=4
  [ 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1 ], // y=5  dead-end branch left
  [ 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1 ], // y=6
  [ 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1 ], // y=7
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=8
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=9  M at (10,9)
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=10
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1 ], // y=11
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1 ], // y=12
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1 ], // y=13  dead-end branch right
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1 ], // y=14
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1 ], // y=15
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1 ], // y=16
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1 ], // y=17
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1 ], // y=18  E at (17,18)
  [ 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ], // y=19
]

const START = { x: 1, y: 1 }
const FOOD_MIDDLE = { x: 10, y: 9 }
const FOOD_END = { x: 17, y: 18 }

// Points along the correct solution path from S → M → E
const SOLUTION_PATH = [
  { x: 1, y: 1 },   // start
  { x: 4, y: 3 },   // corridor turn
  { x: 10, y: 3 },  // upper horizontal corridor
  { x: 12, y: 5 },  // downward before M
  { x: 10, y: 9 },  // middle food
  { x: 10, y: 11 }, // below M
  { x: 17, y: 11 }, // right horizontal corridor
  { x: 17, y: 15 }, // vertical descent
  { x: 17, y: 18 }, // end food
]

// Dead-end cells that should be pruned
const DEAD_END_CELLS = [
  { x: 1, y: 5 },   // left dead-end branch
  { x: 2, y: 5 },
  { x: 14, y: 13 }, // right dead-end branch
  { x: 15, y: 13 },
]

function createMazeSim() {
  const sim = new PhysarumSim(20, 20, {
    sensorAngle: Math.PI / 8,     // 22.5° — tight trail following
    rotationAngle: Math.PI / 4,   // 45°
    sensorDistance: 3,             // shorter for small maze corridors
    stepSize: 1,
    depositAmount: 5,
    decayFactor: 0.9,
    maxAgents: 1500,
    foodDepositAmount: 40,
    foodSpreadRadius: 1,          // tight spread for narrow corridors
    slimeAvoidanceWeight: 0.2,
  })

  sim.loadMaze(MAZE)
  sim.addFood(FOOD_MIDDLE.x, FOOD_MIDDLE.y)
  sim.addFood(FOOD_END.x, FOOD_END.y)
  sim.seedAgents(START.x, START.y, 400, 1)

  return sim
}

/** Check if a cell has significant trail (slime presence) */
function hasTrail(sim, x, y, threshold = 0.5) {
  return sim.trailMap[y * sim.width + x] > threshold
}

/** Get trail value at a cell */
function trailAt(sim, x, y) {
  return sim.trailMap[y * sim.width + x]
}

/** Get average trail value along a list of points */
function avgTrail(sim, points) {
  let sum = 0
  for (const p of points) {
    sum += trailAt(sim, p.x, p.y)
  }
  return sum / points.length
}

describe('Physarum maze solving', () => {
  it('maze layout is valid — corridors are open, walls are blocked', () => {
    const sim = createMazeSim()

    // Start should be open
    expect(sim.blocked[START.y * 20 + START.x]).toBe(0)
    // Food positions should be open
    expect(sim.blocked[FOOD_MIDDLE.y * 20 + FOOD_MIDDLE.x]).toBe(0)
    expect(sim.blocked[FOOD_END.y * 20 + FOOD_END.x]).toBe(0)
    // Border should be walls
    expect(sim.blocked[0 * 20 + 0]).toBe(1)
    expect(sim.blocked[19 * 20 + 19]).toBe(1)
    // All solution path cells should be open
    for (const p of SOLUTION_PATH) {
      expect(sim.blocked[p.y * 20 + p.x]).toBe(0)
    }
  })

  it('agents are seeded at the start position', () => {
    const sim = createMazeSim()
    expect(sim.agentCount).toBeGreaterThan(0)

    // Most agents should be near the start
    let nearStart = 0
    for (let i = 0; i < sim.agentCount; i++) {
      const dx = sim.agentX[i] - START.x
      const dy = sim.agentY[i] - START.y
      if (Math.sqrt(dx * dx + dy * dy) < 3) nearStart++
    }
    expect(nearStart).toBeGreaterThan(sim.agentCount * 0.5)
  })

  it('chemoattractant does not diffuse through walls', () => {
    const sim = createMazeSim()

    // Run a few steps so food emits trail
    for (let i = 0; i < 50; i++) sim.step()

    // Check that wall cells have no trail
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        if (sim.blocked[y * 20 + x]) {
          expect(trailAt(sim, x, y)).toBe(0)
        }
      }
    }
  })

  it('slime mold reaches the middle food source', () => {
    const sim = createMazeSim()

    // Run simulation — enough steps for agents to navigate corridors
    for (let i = 0; i < 2000; i++) sim.step()

    // The middle food should have significant trail nearby
    const middleTrail = trailAt(sim, FOOD_MIDDLE.x, FOOD_MIDDLE.y)
    expect(middleTrail).toBeGreaterThan(1)
  })

  it('slime mold reaches the end food source', () => {
    const sim = createMazeSim()

    for (let i = 0; i < 4000; i++) sim.step()

    const endTrail = trailAt(sim, FOOD_END.x, FOOD_END.y)
    expect(endTrail).toBeGreaterThan(1)
  })

  it('slime establishes trail along the solution path', () => {
    const sim = createMazeSim()

    for (let i = 0; i < 4000; i++) sim.step()

    // Check that most solution-path cells have trail
    let pathCellsWithTrail = 0
    for (const p of SOLUTION_PATH) {
      if (hasTrail(sim, p.x, p.y, 0.3)) pathCellsWithTrail++
    }
    const pathCoverage = pathCellsWithTrail / SOLUTION_PATH.length
    expect(pathCoverage).toBeGreaterThan(0.6)
  })

  it('dead-end branches are pruned (lower trail than solution path)', () => {
    const sim = createMazeSim()

    for (let i = 0; i < 4000; i++) sim.step()

    const solutionAvg = avgTrail(sim, SOLUTION_PATH)
    const deadEndAvg = avgTrail(sim, DEAD_END_CELLS)

    // Dead ends should have significantly less trail than the solution path
    expect(deadEndAvg).toBeLessThan(solutionAvg)
  })

  it('no trail exists inside wall cells at any point', () => {
    const sim = createMazeSim()

    for (let i = 0; i < 4000; i++) {
      sim.step()

      // Spot-check every 500 steps
      if (i % 500 === 0) {
        for (let y = 0; y < 20; y++) {
          for (let x = 0; x < 20; x++) {
            if (sim.blocked[y * 20 + x]) {
              expect(trailAt(sim, x, y)).toBe(0)
            }
          }
        }
      }
    }
  })
})
