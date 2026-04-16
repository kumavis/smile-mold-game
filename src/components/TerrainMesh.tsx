import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { TerrainData, CELL_COLORS_ALT } from '../utils/terrainGen.ts'

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()

function hashVoxel(x: number, y: number, z: number): number {
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0
}

interface Props {
  terrain: TerrainData
}

export default function TerrainMesh({ terrain }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const { voxels } = terrain

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]
      tempMatrix.makeTranslation(v.x + 0.5, v.y + 0.5, v.z + 0.5)
      mesh.setMatrixAt(i, tempMatrix)

      const alts = CELL_COLORS_ALT[v.type] || ['#ff00ff']
      const hash = hashVoxel(v.x, v.y, v.z)
      const colorHex = alts[hash % alts.length]
      tempColor.set(colorHex)
      mesh.setColorAt(i, tempColor)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [voxels])

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, voxels.length]}>
      <meshLambertMaterial color={0xffffff} vertexColors />
    </instancedMesh>
  )
}
