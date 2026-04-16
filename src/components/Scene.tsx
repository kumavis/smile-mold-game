import React, { useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import TerrainMesh from './TerrainMesh.tsx'
import SlimeMoldMesh from './SlimeMoldMesh.tsx'
import FoodMesh from './FoodMesh.tsx'
import Terrarium from './Terrarium.tsx'
import type { TerrainData } from '../utils/terrainGen.ts'
import type { SlimeCell, GridPos } from '../simulation/PhysarumSim.ts'

interface Props {
  terrain: TerrainData
  slimeCells: SlimeCell[]
  slimeColor: string
  foodSources: GridPos[]
  gridSize: number
  foodMode: boolean
  onPlaceFood: (x: number, z: number) => void
  onRemoveFood: (x: number, z: number) => void
  heightMap: Uint8Array
}

export default function Scene({
  terrain, slimeCells, slimeColor, foodSources, gridSize,
  foodMode, onPlaceFood, onRemoveFood, heightMap
}: Props) {
  const offset = -gridSize / 2

  return (
    <Canvas
      camera={{ position: [0, 40, 50], fov: 45, near: 0.1, far: 200 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', touchAction: 'none' }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#1a1a2e']} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 40, 20]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 20, -10]} intensity={0.3} />
      <pointLight position={[0, 30, 0]} intensity={0.4} color="#e8d5b7" />

      <group position={[offset, 0, offset]}>
        <TerrainMesh terrain={terrain} />
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
        foodMode={foodMode}
        onPlaceFood={onPlaceFood}
        onRemoveFood={onRemoveFood}
      />

      <OrbitControls
        target={[0, 5, 0]}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={20}
        maxDistance={80}
        enableDamping
        dampingFactor={0.1}
      />
    </Canvas>
  )
}

interface FloorProps {
  gridSize: number
  foodMode: boolean
  onPlaceFood: (x: number, z: number) => void
  onRemoveFood: (x: number, z: number) => void
}

/**
 * Invisible plane for click/tap interaction to place/remove food.
 * Handles both mouse clicks (desktop) and touch/pointer events (mobile).
 */
function FloorInteraction({ gridSize, foodMode, onPlaceFood, onRemoveFood }: FloorProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const offset = gridSize / 2

  const handleInteraction = useCallback((e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!foodMode) return
    e.stopPropagation()
    const point = e.point
    const gx = Math.round(point.x + offset)
    const gz = Math.round(point.z + offset)
    if (gx >= 0 && gx < gridSize && gz >= 0 && gz < gridSize) {
      // Shift+click or right-click to remove; normal click/tap to place
      const nativeEvent = e.nativeEvent
      if (nativeEvent instanceof MouseEvent && (nativeEvent.button === 2 || nativeEvent.shiftKey)) {
        onRemoveFood(gx, gz)
      } else {
        onPlaceFood(gx, gz)
      }
    }
  }, [foodMode, gridSize, offset, onPlaceFood, onRemoveFood])

  return (
    <mesh
      ref={meshRef}
      position={[0, 2, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={handleInteraction}
      visible={false}
    >
      <planeGeometry args={[gridSize, gridSize]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
