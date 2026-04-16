import React, { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import TerrainMesh from './TerrainMesh.tsx'
import SlimeMoldMesh from './SlimeMoldMesh.tsx'
import FoodMesh from './FoodMesh.tsx'
import ChemoTrailMesh from './ChemoTrailMesh.tsx'
import Terrarium from './Terrarium.tsx'
import type { TerrainData } from '../utils/terrainGen.ts'
import type { SlimeCell, ChemoCell, FoodSource } from '../simulation/PhysarumSim.ts'

interface Props {
  terrain: TerrainData
  slimeCells: SlimeCell[]
  chemoCells: ChemoCell[]
  slimeColor: string
  foodSources: FoodSource[]
  gridSize: number
  onPlaceFood: (x: number, z: number) => void
  onRemoveFood: (x: number, z: number) => void
  heightMap: Uint8Array
}

export default function Scene({
  terrain, slimeCells, chemoCells, slimeColor, foodSources, gridSize,
  onPlaceFood, onRemoveFood, heightMap
}: Props) {
  const offset = -gridSize / 2

  // Camera / controls tuned to the terrarium size
  const cameraDistance = gridSize * 1.3
  const cameraHeight = gridSize * 0.8
  const minZoom = gridSize * 0.3
  const maxZoom = gridSize * 3

  return (
    <Canvas
      camera={{ position: [0, cameraHeight, cameraDistance], fov: 45, near: 0.1, far: 500 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1a1a2e']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[gridSize * 0.5, gridSize, gridSize * 0.5]} intensity={0.8} castShadow />
      <directionalLight position={[-gridSize * 0.3, gridSize * 0.5, -gridSize * 0.3]} intensity={0.3} />
      <pointLight position={[0, gridSize * 0.7, 0]} intensity={0.4} color="#e8d5b7" />

      <group position={[offset, 0, offset]}>
        <TerrainMesh terrain={terrain} />
        <ChemoTrailMesh
          cells={chemoCells}
          heightMap={heightMap}
          gridWidth={gridSize}
        />
        <SlimeMoldMesh
          cells={slimeCells}
          color={slimeColor}
          heightMap={heightMap}
          gridWidth={gridSize}
        />
        <FoodMesh
          foodSources={foodSources}
          heightMap={heightMap}
          gridWidth={gridSize}
        />
      </group>

      <Terrarium size={gridSize} />

      <FloorInteraction
        gridSize={gridSize}
        onPlaceFood={onPlaceFood}
        onRemoveFood={onRemoveFood}
      />

      <OrbitControls
        target={[0, 5, 0]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={minZoom}
        maxDistance={maxZoom}
        enableDamping
        dampingFactor={0.1}
      />
    </Canvas>
  )
}

interface FloorProps {
  gridSize: number
  onPlaceFood: (x: number, z: number) => void
  onRemoveFood: (x: number, z: number) => void
}

// Gesture thresholds for distinguishing tap-to-place from drag-to-orbit
const TAP_MAX_MS = 300
const TAP_MAX_PX = 8

/**
 * Invisible floor plane that converts taps (short + little travel) into
 * food placements. Longer / more travel → treated as a pan/orbit gesture
 * and ignored, so OrbitControls can take over.
 */
function FloorInteraction({ gridSize, onPlaceFood, onRemoveFood }: FloorProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const offset = gridSize / 2
  const pointerStart = useRef<{ x: number; y: number; time: number } | null>(null)

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerStart.current = {
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      time: Date.now(),
    }
  }, [])

  const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return

    const dx = e.nativeEvent.clientX - start.x
    const dy = e.nativeEvent.clientY - start.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    const duration = Date.now() - start.time

    // Only treat as a tap if short + nearly stationary
    if (distance > TAP_MAX_PX || duration > TAP_MAX_MS) return

    const point = e.point
    const gx = Math.round(point.x + offset)
    const gz = Math.round(point.z + offset)
    if (gx < 0 || gx >= gridSize || gz < 0 || gz >= gridSize) return

    const native = e.nativeEvent
    if (native.shiftKey || (native.button === 2)) {
      onRemoveFood(gx, gz)
    } else {
      onPlaceFood(gx, gz)
    }
  }, [gridSize, offset, onPlaceFood, onRemoveFood])

  return (
    <mesh
      ref={meshRef}
      position={[0, 2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      visible={false}
    >
      <planeGeometry args={[gridSize, gridSize]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
