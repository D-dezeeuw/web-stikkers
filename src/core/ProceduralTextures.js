import { Texture } from './Texture.js'

// Seeded random for deterministic noise
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
}

function hslToRgb(h, s, l) {
    h /= 360
    let r, g, b

    if (s === 0) {
        r = g = b = l
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1/3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1/3)
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function createRainbowGradient(gl, size = 256) {
    const data = new Uint8Array(size * 4)

    for (let i = 0; i < size; i++) {
        const t = i / size
        const h = t * 360
        const rgb = hslToRgb(h, 1.0, 0.5)
        data[i * 4 + 0] = rgb[0]
        data[i * 4 + 1] = rgb[1]
        data[i * 4 + 2] = rgb[2]
        data[i * 4 + 3] = 255
    }

    return new Texture(gl).createFromData(size, 1, data, {
        wrapS: gl.REPEAT,
        wrapT: gl.CLAMP_TO_EDGE
    })
}

export function createNoiseTexture(gl, size = 256) {
    const data = new Uint8Array(size * size * 4)

    for (let i = 0; i < size * size; i++) {
        // Use deterministic seeded random instead of Math.random()
        const value = Math.floor(seededRandom(i * 1.1) * 256)
        data[i * 4 + 0] = value
        data[i * 4 + 1] = Math.floor(seededRandom(i * 2.2) * 256)
        data[i * 4 + 2] = Math.floor(seededRandom(i * 3.3) * 256)
        data[i * 4 + 3] = 255
    }

    return new Texture(gl).createFromData(size, size, data, {
        wrapS: gl.REPEAT,
        wrapT: gl.REPEAT
    })
}

export function createFoilPattern(gl, size = 256) {
    const data = new Uint8Array(size * size * 4)

    for (let i = 0; i < size * size; i++) {
        // Sparse bright points for sparkle effect (deterministic)
        const sparkle = seededRandom(i * 4.4) > 0.97 ? 255 : 0
        const base = Math.floor(seededRandom(i * 5.5) * 50)
        data[i * 4 + 0] = sparkle || base
        data[i * 4 + 1] = sparkle || base
        data[i * 4 + 2] = sparkle || base
        data[i * 4 + 3] = 255
    }

    return new Texture(gl).createFromData(size, size, data, {
        wrapS: gl.REPEAT,
        wrapT: gl.REPEAT
    })
}

// Create depth map for parallax effect
// White (255) = foreground (no shift), Black (0) = background (max shift)
export function createDepthMap(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)

    const centerX = width / 2
    const centerY = height / 2

    // Border thickness in pixels (normalized)
    const borderSize = width * 0.08

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4

            // Distance from center (0 at center, 1 at corners)
            const dx = (x - centerX) / centerX
            const dy = (y - centerY) / centerY
            const distFromCenter = Math.sqrt(dx * dx + dy * dy)

            // Distance from edge
            const distFromEdgeX = Math.min(x, width - x)
            const distFromEdgeY = Math.min(y, height - y)
            const distFromEdge = Math.min(distFromEdgeX, distFromEdgeY)

            let depth

            if (distFromEdge < borderSize) {
                // Border area - background (shifts most)
                depth = 0.2 + (distFromEdge / borderSize) * 0.3
            } else {
                // Inner area - gradient from edge to center
                // Center is foreground (1.0), edges are mid-ground
                depth = 0.5 + (1.0 - distFromCenter) * 0.5
            }

            const value = Math.floor(Math.min(1.0, Math.max(0.0, depth)) * 255)
            data[i + 0] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }
    }

    return new Texture(gl).createFromData(width, height, data)
}
