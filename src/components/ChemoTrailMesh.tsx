import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ChemoCell } from '../simulation/PhysarumSim.ts'

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const MAX_CHEMO_VOXELS = 4000

// Low intensity = faint purple, high intensity = bright teal
const COLOR_LOW = new THREE.Color('#5030a0')
const COLOR_HIGH = new THREE.Color('#40c8c8')

interface Props {
  cells: ChemoCell[]
  heightMap: Uint8Array
  gridWidth: number
}

export default function ChemoTrailMesh({ cells, heightMap, gridWidth }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 0.3, 1), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const count = Math.min(cells.length, MAX_CHEMO_VOXELS)

    for (let i = 0; i < count; i++) {
      const cell = cells[i]
      const surfaceH = heightMap[cell.y * gridWidth + cell.x] || 1
      // Lift slightly above terrain surface to avoid z-fighting
      tempMatrix.makeTranslation(cell.x + 0.5, surfaceH + 0.25, cell.y + 0.5)
      mesh.setMatrixAt(i, tempMatrix)

      tempColor.copy(COLOR_LOW).lerp(COLOR_HIGH, cell.intensity)
      mesh.setColorAt(i, tempColor)
    }

    for (let i = count; i < MAX_CHEMO_VOXELS; i++) {
      mesh.setMatrixAt(i, zeroMatrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = count
  }, [cells, heightMap, gridWidth])

  // renderOrder=1 so chemo draws after opaque terrain (renderOrder 0)
  // but before slime/food (renderOrder 2); depthWrite=false prevents
  // translucent instances from culling each other.
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, MAX_CHEMO_VOXELS]}
      renderOrder={1}
    >
      <meshLambertMaterial color={0xffffff} transparent opacity={0.45} depthWrite={false} />
    </instancedMesh>
  )
}
