import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { SlimeCell } from '../simulation/PhysarumSim.ts'

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
const MAX_SLIME_VOXELS = 8000

interface Props {
  cells: SlimeCell[]
  color: string
  heightMap: Uint8Array
  gridWidth: number
}

/**
 * Renders the slime mold as voxel stacks. Each cell's voxel color is
 * modulated by its `recency` signal to convey biological state:
 *
 *   recency >= 0.9  → bright, saturated   (active flow / leading edge)
 *   recency ~ 0.5   → base slime color    (established tube / body)
 *   recency < 0.3   → dim, desaturated    (retracting / being reabsorbed)
 *
 * Voxel stack height is driven by density (trail concentration), so
 * well-trafficked tubes look thick while faded corridors are thin.
 */
export default function SlimeMoldMesh({ cells, color, heightMap, gridWidth }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const baseColor = useMemo(() => new THREE.Color(color), [color])
  const baseHSL = useMemo(() => {
    const hsl = { h: 0, s: 0, l: 0 }
    baseColor.getHSL(hsl)
    return hsl
  }, [baseColor])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const count = Math.min(cells.length, MAX_SLIME_VOXELS)
    let idx = 0

    for (let i = 0; i < count; i++) {
      const cell = cells[i]
      const surfaceH = heightMap[cell.y * gridWidth + cell.x] || 1
      const recency = cell.recency

      // Map recency → color adjustments
      // recency 1.0 (agent here)  → lightness +0.18, saturation x1.1
      // recency 0.5 (body)        → lightness +0, saturation x1
      // recency 0.0 (fading)      → lightness -0.22, saturation x0.35
      const lightShift = (recency - 0.5) * 0.4
      const satFactor = 0.35 + recency * 0.75

      for (let h = 0; h < cell.height && idx < MAX_SLIME_VOXELS; h++) {
        const yPos = surfaceH + h + 0.5
        tempMatrix.makeTranslation(cell.x + 0.5, yPos, cell.y + 0.5)
        mesh.setMatrixAt(idx, tempMatrix)

        // Stack layers get slightly dimmer toward the top for depth
        const heightDim = h * 0.04
        const l = Math.max(0.06, Math.min(0.78, baseHSL.l + lightShift - heightDim))
        const s = Math.max(0.12, Math.min(1.0, baseHSL.s * satFactor))
        tempColor.setHSL(baseHSL.h, s, l)

        mesh.setColorAt(idx, tempColor)
        idx++
      }
    }

    for (let i = idx; i < MAX_SLIME_VOXELS; i++) {
      mesh.setMatrixAt(i, zeroMatrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = idx
  }, [cells, baseHSL, heightMap, gridWidth])

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, MAX_SLIME_VOXELS]}>
      <meshLambertMaterial color={0xffffff} transparent opacity={0.88} />
    </instancedMesh>
  )
}
