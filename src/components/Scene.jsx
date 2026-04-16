import React, { useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import TerrainMesh from './TerrainMesh'
import SlimeMoldMesh from './SlimeMoldMesh'
import FoodMesh from './FoodMesh'
import Terrarium from './Terrarium'

export default function Scene({
  terrain, slimeCells, slimeColor, foodSources, gridSize,
  foodMode, onPlaceFood, onRemoveFood, heightMap
}) {
  const offset = -gridSize / 2

  return (
    <Canvas
      camera={{ position: [0, 40, 50], fov: 45, near: 0.1, far: 200 }}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
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
        heightMap={heightMap}
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

/** Invisible plane for click interaction to place/remove food */
function FloorInteraction({ gridSize, foodMode, onPlaceFood, onRemoveFood, heightMap }) {
  const meshRef = useRef()
  const offset = gridSize / 2

  const handleClick = useCallback((e) => {
    if (!foodMode) return
    e.stopPropagation()
    const point = e.point
    const gx = Math.round(point.x + offset)
    const gz = Math.round(point.z + offset)
    if (gx >= 0 && gx < gridSize && gz >= 0 && gz < gridSize) {
      if (e.button === 2 || e.shiftKey) {
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
      onClick={handleClick}
      onContextMenu={handleClick}
      visible={false}
    >
      <planeGeometry args={[gridSize, gridSize]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  )
}
