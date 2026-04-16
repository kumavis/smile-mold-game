/**
 * Simple terrain generator for the terrarium.
 * Produces a heightmap + material map using value noise.
 */

// Simple seeded pseudo-random
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// 2D value noise
function valueNoise(width, height, scale, rng) {
  // Generate grid of random values
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
      // Smoothstep
      const sx = fx * fx * (3 - 2 * fx)
      const sy = fy * fy * (3 - 2 * fy)
      // Bilinear
      const v00 = grid[iy * gw + ix]
      const v10 = grid[iy * gw + ix + 1]
      const v01 = grid[(iy + 1) * gw + ix]
      const v11 = grid[(iy + 1) * gw + ix + 1]
      const v = v00 * (1 - sx) * (1 - sy) + v10 * sx * (1 - sy) +
                v01 * (1 - sx) * sy + v11 * sx * sy
      result[y * width + x] = v
    }
  }
  return result
}

/**
 * CELL_TYPES:
 * 0 = air
 * 1 = soil (dark brown)
 * 2 = rock (gray)
 * 3 = gravel (light brown)
 * 4 = moss (dark green) — moist areas
 */
export const CELL_COLORS = {
  1: '#4a3728', // soil
  2: '#6b6b6b', // rock
  3: '#8b7355', // gravel
  4: '#2d5a1e', // moss
}

export const CELL_COLORS_ALT = {
  1: ['#4a3728', '#3d2e20', '#55402f', '#443022'],
  2: ['#6b6b6b', '#5a5a5a', '#7a7a7a', '#636363'],
  3: ['#8b7355', '#7a6448', '#9c8462', '#84694d'],
  4: ['#2d5a1e', '#245016', '#366826', '#1e4a14'],
}

/**
 * Generate terrain for the terrarium.
 * Returns { heightMap, materialMap, voxels }
 * voxels is an array of { x, y, z, type } for 3D rendering
 */
export function generateTerrain(width, depth, seed = 42) {
  const rng = mulberry32(seed)

  // Multi-octave noise for height
  const noise1 = valueNoise(width, depth, 12, mulberry32(seed))
  const noise2 = valueNoise(width, depth, 6, mulberry32(seed + 1))
  const noise3 = valueNoise(width, depth, 3, mulberry32(seed + 2))

  // Material noise
  const matNoise = valueNoise(width, depth, 8, mulberry32(seed + 3))
  const moistNoise = valueNoise(width, depth, 10, mulberry32(seed + 4))

  const heightMap = new Uint8Array(width * depth)
  const materialMap = new Uint8Array(width * depth)
  const voxels = []

  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const idx = z * width + x

      // Combine noise octaves for height (1-4 range)
      let h = noise1[idx] * 0.6 + noise2[idx] * 0.3 + noise3[idx] * 0.1
      // Create slight bowl shape (lower in center for terrarium feel)
      const cx = (x - width / 2) / (width / 2)
      const cz = (z - depth / 2) / (depth / 2)
      const edgeDist = Math.max(Math.abs(cx), Math.abs(cz))
      h = h * 0.7 + edgeDist * 0.3

      const height = Math.max(1, Math.min(4, Math.round(h * 3 + 1)))
      heightMap[idx] = height

      // Determine material
      const mat = matNoise[idx]
      const moist = moistNoise[idx]
      let type
      if (mat > 0.75) {
        type = 2 // rock
      } else if (moist > 0.7 && height <= 2) {
        type = 4 // moss (in low, moist areas)
      } else if (mat > 0.5) {
        type = 3 // gravel
      } else {
        type = 1 // soil
      }
      materialMap[idx] = type

      // Generate voxel stack
      for (let y = 0; y < height; y++) {
        // Bottom layers are always soil/rock, surface gets the material
        const voxelType = y < height - 1 ? 1 : type
        voxels.push({ x, y, z, type: voxelType })
      }
    }
  }

  return { heightMap, materialMap, voxels, width, depth }
}

/** Get surface height at a grid position */
export function getSurfaceHeight(heightMap, width, x, z) {
  if (x < 0 || x >= width || z < 0) return 1
  const depth = heightMap.length / width
  if (z >= depth) return 1
  return heightMap[z * width + x]
}
