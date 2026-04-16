import React, { useMemo } from 'react'
import * as THREE from 'three'

/** Glass terrarium box — transparent walls with a subtle green tint */
export default function Terrarium({ size }) {
  const halfSize = size / 2
  const wallHeight = 12
  const thickness = 0.3

  const glassMaterial = useMemo(() => (
    <meshPhysicalMaterial
      color="#c8e6c9"
      transparent
      opacity={0.12}
      roughness={0.1}
      metalness={0}
      side={THREE.DoubleSide}
      depthWrite={false}
    />
  ), [])

  const edgeMaterial = useMemo(() => (
    <meshLambertMaterial color="#90a090" transparent opacity={0.4} />
  ), [])

  // Four glass walls + floor
  const walls = [
    // Back wall
    { pos: [0, wallHeight / 2, -halfSize], scale: [size, wallHeight, thickness] },
    // Front wall
    { pos: [0, wallHeight / 2, halfSize], scale: [size, wallHeight, thickness] },
    // Left wall
    { pos: [-halfSize, wallHeight / 2, 0], scale: [thickness, wallHeight, size] },
    // Right wall
    { pos: [halfSize, wallHeight / 2, 0], scale: [thickness, wallHeight, size] },
  ]

  // Edge frames for the terrarium
  const edges = [
    // Vertical corners
    { pos: [-halfSize, wallHeight / 2, -halfSize], scale: [0.4, wallHeight, 0.4] },
    { pos: [halfSize, wallHeight / 2, -halfSize], scale: [0.4, wallHeight, 0.4] },
    { pos: [-halfSize, wallHeight / 2, halfSize], scale: [0.4, wallHeight, 0.4] },
    { pos: [halfSize, wallHeight / 2, halfSize], scale: [0.4, wallHeight, 0.4] },
    // Top horizontal edges
    { pos: [0, wallHeight, -halfSize], scale: [size + 0.4, 0.4, 0.4] },
    { pos: [0, wallHeight, halfSize], scale: [size + 0.4, 0.4, 0.4] },
    { pos: [-halfSize, wallHeight, 0], scale: [0.4, 0.4, size + 0.4] },
    { pos: [halfSize, wallHeight, 0], scale: [0.4, 0.4, size + 0.4] },
  ]

  return (
    <group>
      {/* Glass floor */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshLambertMaterial color="#2a2a1e" />
      </mesh>

      {/* Glass walls */}
      {walls.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.pos}>
          <boxGeometry args={w.scale} />
          {glassMaterial}
        </mesh>
      ))}

      {/* Frame edges */}
      {edges.map((e, i) => (
        <mesh key={`edge-${i}`} position={e.pos}>
          <boxGeometry args={e.scale} />
          {edgeMaterial}
        </mesh>
      ))}
    </group>
  )
}
