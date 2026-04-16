import React, { useState, useCallback, useRef, useEffect } from 'react'
import Scene from './components/Scene'
import UI from './components/UI'
import { PhysarumSim } from './simulation/PhysarumSim'
import { generateTerrain } from './utils/terrainGen'

const GRID_SIZE = 48
const STORAGE_KEY = 'slime-mold-terrarium'

const DEFAULTS = {
  slimeName: 'Blobby',
  slimeColor: '#d4e52e',
  sensorAngle: Math.PI / 8,       // 22.5°
  rotationAngle: Math.PI / 4,     // 45°
  sensorDistance: 5,
  depositAmount: 5,
  decayFactor: 0.9,
  slimeAvoidanceWeight: 0.3,
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULTS, ...parsed }
    }
  } catch { /* ignore corrupt data */ }
  return { ...DEFAULTS }
}

function createGame(seed, behaviorOpts) {
  const terrain = generateTerrain(GRID_SIZE, GRID_SIZE, seed)
  const sim = new PhysarumSim(GRID_SIZE, GRID_SIZE, behaviorOpts)

  // Block cells where rocks are tall (height >= 4 and type === rock)
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
  const saved = useRef(loadSaved()).current

  const [slimeName, setSlimeName] = useState(saved.slimeName)
  const [slimeColor, setSlimeColor] = useState(saved.slimeColor)
  const [terrainSeed, setTerrainSeed] = useState(42)
  const [foodMode, setFoodMode] = useState(false)
  const [simSpeed, setSimSpeed] = useState(3)
  const [paused, setPaused] = useState(false)

  // Behavioral parameters
  const [sensorAngle, setSensorAngle] = useState(saved.sensorAngle)
  const [rotationAngle, setRotationAngle] = useState(saved.rotationAngle)
  const [sensorDistance, setSensorDistance] = useState(saved.sensorDistance)
  const [depositAmount, setDepositAmount] = useState(saved.depositAmount)
  const [decayFactor, setDecayFactor] = useState(saved.decayFactor)
  const [slimeAvoidanceWeight, setSlimeAvoidanceWeight] = useState(saved.slimeAvoidanceWeight)

  const gameRef = useRef(null)
  const [simTick, setSimTick] = useState(0)

  // Initialize game
  if (!gameRef.current) {
    gameRef.current = createGame(terrainSeed, {
      sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight,
    })
  }

  // Persist customization to localStorage
  useEffect(() => {
    const data = {
      slimeName, slimeColor,
      sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [slimeName, slimeColor, sensorAngle, rotationAngle, sensorDistance,
      depositAmount, decayFactor, slimeAvoidanceWeight])

  // Apply behavioral param changes to the live simulation
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

  const handlePlaceFood = useCallback((x, z) => {
    if (!gameRef.current) return
    gameRef.current.sim.addFood(x, z)
    setSimTick(t => t + 1)
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
        sensorAngle={sensorAngle}
        setSensorAngle={setSensorAngle}
        rotationAngle={rotationAngle}
        setRotationAngle={setRotationAngle}
        sensorDistance={sensorDistance}
        setSensorDistance={setSensorDistance}
        depositAmount={depositAmount}
        setDepositAmount={setDepositAmount}
        decayFactor={decayFactor}
        setDecayFactor={setDecayFactor}
        slimeAvoidanceWeight={slimeAvoidanceWeight}
        setSlimeAvoidanceWeight={setSlimeAvoidanceWeight}
        defaults={DEFAULTS}
      />
    </>
  )
}
