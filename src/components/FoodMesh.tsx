import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { GridPos } from '../simulation/PhysarumSim.ts'

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const MAX_FOOD = 200

const FOOD_COLORS: string[] = ['#e8c170', '#d4a843', '#f0d58c', '#c9953a']

interface Props {
  foodSources: GridPos[]
  heightMap: Uint8Array
  gridWidth: number
}

export default function FoodMesh({ foodSources, heightMap, gridWidth }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.6, 1), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const count = Math.min(foodSources.length, MAX_FOOD)

    for (let i = 0; i < count; i++) {
      const food = foodSources[i]
      const surfaceH = heightMap[food.y * gridWidth + food.x] || 1
      tempMatrix.makeTranslation(food.x + 0.5, surfaceH + 0.3, food.y + 0.5)
      mesh.setMatrixAt(i, tempMatrix)

      tempColor.set(FOOD_COLORS[i % FOOD_COLORS.length])
      mesh.setColorAt(i, tempColor)
    }

    for (let i = count; i < MAX_FOOD; i++) {
      mesh.setMatrixAt(i, zeroMatrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = count
  }, [foodSources, heightMap, gridWidth])

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, MAX_FOOD]}>
      <meshLambertMaterial color={0xffffff} vertexColors />
    </instancedMesh>
  )
}
