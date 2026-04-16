import React, { useState, useCallback, useRef, useEffect } from 'react'
import Scene from './components/Scene'
import UI from './components/UI'
import { PhysarumSim } from './simulation/PhysarumSim'
import { generateTerrain, getSurfaceHeight } from './utils/terrainGen'

const GRID_SIZE = 48

function createGame(seed, slimeColor) {
  const terrain = generateTerrain(GRID_SIZE, GRID_SIZE, seed)
  const sim = new PhysarumSim(GRID_SIZE, GRID_SIZE)

  // Block cells where rocks are tall (height >= 3 and type === rock)
  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = z * GRID_SIZE + x
      if (terrain.heightMap[idx] >= 4 && terrain.materialMap[idx] === 2) {
        sim.setBlocked(x, z, 1)
      }
    }
  }

  // Seed initial slime mold in the center
  const cx = Math.floor(GRID_SIZE / 2)
  const cy = Math.floor(GRID_SIZE / 2)
  sim.seedAgents(cx, cy, 300, 4)

  return { terrain, sim }
}

export default function App() {
  const [slimeName, setSlimeName] = useState('Blobby')
  const [slimeColor, setSlimeColor] = useState('#d4e52e')
  const [terrainSeed, setTerrainSeed] = useState(42)
  const [foodMode, setFoodMode] = useState(false)
  const [simSpeed, setSimSpeed] = useState(3)
  const [paused, setPaused] = useState(false)

  const gameRef = useRef(null)
  const [simTick, setSimTick] = useState(0)

  // Initialize game
  if (!gameRef.current) {
    gameRef.current = createGame(terrainSeed, slimeColor)
  }

  const regenerateTerrain = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 100000)
    setTerrainSeed(newSeed)
    gameRef.current = createGame(newSeed, slimeColor)
    setSimTick(0)
  }, [slimeColor])

  const handlePlaceFood = useCallback((x, z) => {
    if (!gameRef.current) return
    gameRef.current.sim.addFood(x, z)
    setSimTick(t => t + 1) // trigger re-render
  }, [])

  const handleRemoveFood = useCallback((x, z) => {
    if (!gameRef.current) return
    gameRef.current.sim.removeFood(x, z)
    setSimTick(t => t + 1)
  }, [])

  // Simulation loop
  useEffect(() => {
    if (paused || !gameRef.current) return
    const interval = setInterval(() => {
      for (let i = 0; i < simSpeed; i++) {
        gameRef.current.sim.step()
      }
      setSimTick(t => t + 1)
    }, 50)
    return () => clearInterval(interval)
  }, [paused, simSpeed])

  const { terrain, sim } = gameRef.current
  const slimeCells = sim.getActiveCells(0.06)
  const foodSources = sim.foodSources

  return (
    <>
      <Scene
        terrain={terrain}
        slimeCells={slimeCells}
        slimeColor={slimeColor}
        foodSources={foodSources}
        gridSize={GRID_SIZE}
        foodMode={foodMode}
        onPlaceFood={handlePlaceFood}
        onRemoveFood={handleRemoveFood}
        heightMap={terrain.heightMap}
      />
      <UI
        slimeName={slimeName}
        setSlimeName={setSlimeName}
        slimeColor={slimeColor}
        setSlimeColor={setSlimeColor}
        onRegenTerrain={regenerateTerrain}
        foodMode={foodMode}
        setFoodMode={setFoodMode}
        simSpeed={simSpeed}
        setSimSpeed={setSimSpeed}
        paused={paused}
        setPaused={setPaused}
        agentCount={sim.agentCount}
        foodCount={foodSources.length}
      />
    </>
  )
}
