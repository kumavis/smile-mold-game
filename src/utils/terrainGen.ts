/**
 * Simple terrain generator for the terrarium.
 * Produces a heightmap + material map using value noise.
 */

/** Terrain cell material types */
export const enum CellType {
  Air = 0,
  Soil = 1,
  Rock = 2,
  Gravel = 3,
  Moss = 4,
}

/** A single terrain voxel for 3D rendering */
export interface TerrainVoxel {
  x: number
  y: number
  z: number
  type: CellType
}

/** Complete terrain data returned by generateTerrain */
export interface TerrainData {
  heightMap: Uint8Array
  materialMap: Uint8Array
  voxels: TerrainVoxel[]
  width: number
  depth: number
}

/** Color hex string variants per cell type for visual variety */
export const CELL_COLORS_ALT: Record<number, string[]> = {
  [CellType.Soil]:   ['#4a3728', '#3d2e20', '#55402f', '#443022'],
  [CellType.Rock]:   ['#6b6b6b', '#5a5a5a', '#7a7a7a', '#636363'],
  [CellType.Gravel]: ['#8b7355', '#7a6448', '#9c8462', '#84694d'],
  [CellType.Moss]:   ['#2d5a1e', '#245016', '#366826', '#1e4a14'],
}

// Simple seeded pseudo-random (mulberry32)
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// 2D value noise
function valueNoise(width: number, height: number, scale: number, rng: () => number): Float32Array {
  const gw = Math.ceil(width / scale) + 2
  const gh = Math.ceil(height / scale) + 2
  const grid = new Float32Array(gw * gh)
  for (let i = 0; i < grid.length; i++) grid[i] = rng()

  const result = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const gx = x / scale
      const gy = y / scale
      const ix = Math.floor(gx)
      const iy = Math.floor(gy)
      const fx = gx - ix
      const fy = gy - iy
      const sx = fx * fx * (3 - 2 * fx)
      const sy = fy * fy * (3 - 2 * fy)
      const v00 = grid[iy * gw + ix]
      const v10 = grid[iy * gw + ix + 1]
      const v01 = grid[(iy + 1) * gw + ix]
      const v11 = grid[(iy + 1) * gw + ix + 1]
      result[y * width + x] =
        v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) +
        v01 * (1 - sx) * sy + v11 * sx * sy
    }
  }
  return result
}

export function generateTerrain(width: number, depth: number, seed: number = 42): TerrainData {
  const noise1 = valueNoise(width, depth, 12, mulberry32(seed))
  const noise2 = valueNoise(width, depth, 6, mulberry32(seed + 1))
  const noise3 = valueNoise(width, depth, 3, mulberry32(seed + 2))
  const matNoise = valueNoise(width, depth, 8, mulberry32(seed + 3))
  const moistNoise = valueNoise(width, depth, 10, mulberry32(seed + 4))

  const heightMap = new Uint8Array(width * depth)
  const materialMap = new Uint8Array(width * depth)
  const voxels: TerrainVoxel[] = []

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x

      let h = noise1[idx] * 0.6 + noise2[idx] * 0.3 + noise3[idx] * 0.1
      const cx = (x - width / 2) / (width / 2)
      const cz = (z - depth / 2) / (depth / 2)
      const edgeDist = Math.max(Math.abs(cx), Math.abs(cz))
      h = h * 0.7 + edgeDist * 0.3

      const height = Math.max(1, Math.min(4, Math.round(h * 3 + 1)))
      heightMap[idx] = height

      const mat = matNoise[idx]
      const moist = moistNoise[idx]
      let type: CellType
      if (mat > 0.75) {
        type = CellType.Rock
      } else if (moist > 0.7 && height <= 2) {
        type = CellType.Moss
      } else if (mat > 0.5) {
        type = CellType.Gravel
      } else {
        type = CellType.Soil
      }
      materialMap[idx] = type

      for (let y = 0; y < height; y++) {
        const voxelType = y < height - 1 ? CellType.Soil : type
        voxels.push({ x, y, z, type: voxelType })
      }
    }
  }

  return { heightMap, materialMap, voxels, width, depth }
}

export function getSurfaceHeight(heightMap: Uint8Array, width: number, x: number, z: number): number {
  if (x < 0 || x >= width || z < 0) return 1
  const depth = heightMap.length / width
  if (z >= depth) return 1
  return heightMap[z * width + x]
}
