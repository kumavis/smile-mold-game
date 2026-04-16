import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { CELL_COLORS_ALT } from '../utils/terrainGen'

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()

// Simple hash for deterministic per-voxel color variation
function hashVoxel(x, y, z) {
  return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0
}

export default function TerrainMesh({ terrain }) {
  const meshRef = useRef()
  const { voxels } = terrain

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < voxels.length; i++) {
      const v = voxels[i]
      tempMatrix.makeTranslation(v.x + 0.5, v.y + 0.5, v.z + 0.5)
      mesh.setMatrixAt(i, tempMatrix)

      // Pick a color variant for visual interest
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
    <instancedMesh ref={meshRef} args={[geometry, null, voxels.length]}>
      <meshLambertMaterial vertexColors />
    </instancedMesh>
  )
}
