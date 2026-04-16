import React, { useMemo } from 'react'
import * as THREE from 'three'

interface Props {
  size: number
}

export default function Terrarium({ size }: Props) {
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

  const walls = [
    { pos: [0, wallHeight / 2, -halfSize] as const, scale: [size, wallHeight, thickness] as const },
    { pos: [0, wallHeight / 2, halfSize] as const, scale: [size, wallHeight, thickness] as const },
    { pos: [-halfSize, wallHeight / 2, 0] as const, scale: [thickness, wallHeight, size] as const },
    { pos: [halfSize, wallHeight / 2, 0] as const, scale: [thickness, wallHeight, size] as const },
  ]

  const edges = [
    { pos: [-halfSize, wallHeight / 2, -halfSize] as const, scale: [0.4, wallHeight, 0.4] as const },
    { pos: [halfSize, wallHeight / 2, -halfSize] as const, scale: [0.4, wallHeight, 0.4] as const },
    { pos: [-halfSize, wallHeight / 2, halfSize] as const, scale: [0.4, wallHeight, 0.4] as const },
    { pos: [halfSize, wallHeight / 2, halfSize] as const, scale: [0.4, wallHeight, 0.4] as const },
    { pos: [0, wallHeight, -halfSize] as const, scale: [size + 0.4, 0.4, 0.4] as const },
    { pos: [0, wallHeight, halfSize] as const, scale: [size + 0.4, 0.4, 0.4] as const },
    { pos: [-halfSize, wallHeight, 0] as const, scale: [0.4, 0.4, size + 0.4] as const },
    { pos: [halfSize, wallHeight, 0] as const, scale: [0.4, 0.4, size + 0.4] as const },
  ]

  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshLambertMaterial color="#2a2a1e" />
      </mesh>

      {walls.map((w, i) => (
        <mesh key={`wall-${i}`} position={w.pos}>
          <boxGeometry args={w.scale} />
          {glassMaterial}
        </mesh>
      ))}

      {edges.map((e, i) => (
        <mesh key={`edge-${i}`} position={e.pos}>
          <boxGeometry args={e.scale} />
          {edgeMaterial}
        </mesh>
      ))}
    </group>
  )
}
