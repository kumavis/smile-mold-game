import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()
const MAX_SLIME_VOXELS = 8000

export default function SlimeMoldMesh({ cells, color, heightMap, gridWidth }) {
  const meshRef = useRef()
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  const baseColor = useMemo(() => new THREE.Color(color), [color])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const count = Math.min(cells.length, MAX_SLIME_VOXELS)
    let idx = 0

    for (let i = 0; i < count; i++) {
      const cell = cells[i]
      // Get terrain surface height at this position
      const surfaceH = heightMap[cell.y * gridWidth + cell.x] || 1
      const intensity = cell.intensity

      // Render voxels on top of terrain
      for (let h = 0; h < cell.height && idx < MAX_SLIME_VOXELS; h++) {
        const yPos = surfaceH + h + 0.5
        tempMatrix.makeTranslation(cell.x + 0.5, yPos, cell.y + 0.5)
        mesh.setMatrixAt(idx, tempMatrix)

        // Color variation: brighter in center of trails, translucent at edges
        tempColor.copy(baseColor)
        // Slightly vary hue based on height and intensity
        const hsl = {}
        tempColor.getHSL(hsl)
        hsl.l = Math.min(0.7, hsl.l + intensity * 0.15 - h * 0.05)
        hsl.s = Math.min(1.0, hsl.s + (1 - intensity) * 0.1)
        tempColor.setHSL(hsl.h, hsl.s, hsl.l)

        mesh.setColorAt(idx, tempColor)
        idx++
      }
    }

    // Hide unused instances
    const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let i = idx; i < MAX_SLIME_VOXELS; i++) {
      mesh.setMatrixAt(i, zeroMatrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = idx
  }, [cells, baseColor, heightMap, gridWidth])

  return (
    <instancedMesh ref={meshRef} args={[geometry, null, MAX_SLIME_VOXELS]}>
      <meshLambertMaterial vertexColors transparent opacity={0.85} />
    </instancedMesh>
  )
}
