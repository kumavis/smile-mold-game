import React, { useState, useCallback, useRef, useEffect } from 'react'
import Scene from './components/Scene.tsx'
import UI from './components/UI.tsx'
import type { SlimeCustomization } from './components/UI.tsx'
import { PhysarumSim } from './simulation/PhysarumSim.ts'
import type { PhysarumOptions } from './simulation/PhysarumSim.ts'
import { generateTerrain } from './utils/terrainGen.ts'
import type { TerrainData } from './utils/terrainGen.ts'

const GRID_SIZE = 48
const STORAGE_KEY = 'slime-mold-terrarium'

const DEFAULTS: SlimeCustomization = {
  slimeName: 'Blobby',
  slimeColor: '#d4e52e',
  sensorAngle: Math.PI / 8,
  rotationAngle: Math.PI / 4,
  sensorDistance: 5,
  depositAmount: 5,
  decayFactor: 0.9,
  slimeAvoidanceWeight: 0.3,
}

function loadSaved(): SlimeCustomization {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SlimeCustomization>
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* ignore corrupt data */ }
  return { ...DEFAULTS }
}

interface GameState {
  terrain: TerrainData
  sim: PhysarumSim
}

function createGame(seed: number, behaviorOpts: PhysarumOptions): GameState {
  const terrain = generateTerrain(GRID_SIZE, GRID_SIZE, seed)
  const sim = new PhysarumSim(GRID_SIZE, GRID_SIZE, behaviorOpts)

  for (let z = 0; z < GRID_SIZE; z++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = z * GRID_SIZE + x
      if (terrain.heightMap[idx] >= 4 && terrain.materialMap[idx] === 2) {
        sim.setBlocked(x, z, 1)
      }
    }
  }

  const cx = Math.floor(GRID_SIZE / 2)
  const cy = Math.floor(GRID_SIZE / 2)
  sim.seedAgents(cx, cy, 300, 4)

  return { terrain, sim }
}

export default function App() {
  const saved = useRef(loadSaved()).current

  const [slimeName, setSlimeName] = useState(saved.slimeName)
  const [slimeColor, setSlimeColor] = useState(saved.slimeColor)
  const [terrainSeed, setTerrainSeed] = useState(42)
  const [foodMode, setFoodMode] = useState(false)
  const [simSpeed, setSimSpeed] = useState(3)
  const [paused, setPaused] = useState(false)

  const [sensorAngle, setSensorAngle] = useState(saved.sensorAngle)
  const [rotationAngle, setRotationAngle] = useState(saved.rotationAngle)
  const [sensorDistance, setSensorDistance] = useState(saved.sensorDistance)
  const [depositAmount, setDepositAmount] = useState(saved.depositAmount)
  const [decayFactor, setDecayFactor] = useState(saved.decayFactor)
  const [slimeAvoidanceWeight, setSlimeAvoidanceWeight] = useState(saved.slimeAvoidanceWeight)

  const gameRef = useRef<GameState | null>(null)
  const [simTick, setSimTick] = useState(0)

  if (!gameRef.current) {
    gameRef.current = createGame(terrainSeed, {
      sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight,
    })
  }

  useEffect(() => {
    const data: SlimeCustomization = {
      slimeName, slimeColor,
      sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [slimeName, slimeColor, sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight])

  useEffect(() => {
    if (!gameRef.current) return
    const sim = gameRef.current.sim
    sim.sensorAngle = sensorAngle
    sim.rotationAngle = rotationAngle
    sim.sensorDistance = sensorDistance
    sim.depositAmount = depositAmount
    sim.decayFactor = decayFactor
    sim.slimeAvoidanceWeight = slimeAvoidanceWeight
  }, [sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight])

  const regenerateTerrain = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 100000)
    setTerrainSeed(newSeed)
    gameRef.current = createGame(newSeed, {
      sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight,
    })
    setSimTick(0)
  }, [sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight])

  const handlePlaceFood = useCallback((x: number, z: number) => {
    if (!gameRef.current) return
    gameRef.current.sim.addFood(x, z)
    setSimTick(t => t + 1)
  }, [])

  const handleRemoveFood = useCallback((x: number, z: number) => {
    if (!gameRef.current) return
    gameRef.current.sim.removeFood(x, z)
    setSimTick(t => t + 1)
  }, [])

  useEffect(() => {
    if (paused || !gameRef.current) return
    const interval = setInterval(() => {
      for (let i = 0; i < simSpeed; i++) {
        gameRef.current!.sim.step()
      }
      setSimTick(t => t + 1)
    }, 50)
    return () => clearInterval(interval)
  }, [paused, simSpeed])

  const { terrain, sim } = gameRef.current
  const slimeCells = sim.getActiveCells(0.06)
  const chemoCells = sim.getChemoGradientCells(0.05)
  const foodSources = sim.foodSources

  return (
    <>
      <Scene
        terrain={terrain}
        slimeCells={slimeCells}
        chemoCells={chemoCells}
        slimeColor={slimeColor}
        foodSources={foodSources}
        gridSize={GRID_SIZE}
        foodMode={foodMode}
        onPlaceFood={handlePlaceFood}
        onRemoveFood={handleRemoveFood}
        heightMap={terrain.heightMap}
      />
      <UI
        slimeName={slimeName} setSlimeName={setSlimeName}
        slimeColor={slimeColor} setSlimeColor={setSlimeColor}
        onRegenTerrain={regenerateTerrain}
        foodMode={foodMode} setFoodMode={setFoodMode}
        simSpeed={simSpeed} setSimSpeed={setSimSpeed}
        paused={paused} setPaused={setPaused}
        agentCount={sim.agentCount} foodCount={foodSources.length}
        sensorAngle={sensorAngle} setSensorAngle={setSensorAngle}
        rotationAngle={rotationAngle} setRotationAngle={setRotationAngle}
        sensorDistance={sensorDistance} setSensorDistance={setSensorDistance}
        depositAmount={depositAmount} setDepositAmount={setDepositAmount}
        decayFactor={decayFactor} setDecayFactor={setDecayFactor}
        slimeAvoidanceWeight={slimeAvoidanceWeight} setSlimeAvoidanceWeight={setSlimeAvoidanceWeight}
        defaults={DEFAULTS}
      />
    </>
  )
}
