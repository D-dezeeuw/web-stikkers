export class Texture {
    constructor(gl) {
        this.gl = gl
        this.texture = null
        this.width = 0
        this.height = 0
    }

    async load(url) {
        return new Promise((resolve, reject) => {
            const image = new Image()
            image.crossOrigin = 'anonymous'

            image.onload = () => {
                this.createFromImage(image)
                resolve(this)
            }

            image.onerror = () => {
                reject(new Error(`Failed to load texture: ${url}`))
            }

            image.src = url
        })
    }

    createFromImage(image) {
        const gl = this.gl

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        )

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        gl.generateMipmap(gl.TEXTURE_2D)

        this.width = image.width
        this.height = image.height

        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    createEmpty(width, height, data = null) {
        const gl = this.gl

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        )

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        this.width = width
        this.height = height

        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    bind(unit = 0) {
        const gl = this.gl
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
    }

    unbind() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null)
    }

    destroy() {
        if (this.texture) {
            this.gl.deleteTexture(this.texture)
            this.texture = null
        }
    }
}

// Create procedural textures
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

    const texture = new Texture(gl)
    texture.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    texture.width = size
    texture.height = 1

    return texture
}

// Seeded random for deterministic noise
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
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

    const texture = new Texture(gl)
    texture.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    texture.width = size
    texture.height = size

    return texture
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

    const texture = new Texture(gl)
    texture.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    texture.width = size
    texture.height = size

    return texture
}

// Create depth map for parallax effect
// White (255) = foreground (no shift), Black (0) = background (max shift)
export function createDepthMap(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)

    const centerX = width / 2
    const centerY = height / 2
    const maxDist = Math.sqrt(centerX * centerX + centerY * centerY)

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

    const texture = new Texture(gl)
    texture.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    texture.width = width
    texture.height = height

    return texture
}

// === EFFECT MASK GENERATORS ===

// No mask - full effect everywhere
export function createFullMask(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++) {
        data[i * 4 + 0] = 255
        data[i * 4 + 1] = 255
        data[i * 4 + 2] = 255
        data[i * 4 + 3] = 255
    }
    return createMaskTexture(gl, width, height, data)
}

// Border only - effect on border, none in center (hard edge)
export function createBorderMask(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)
    const borderSize = 0.035 // 3.5% thin border

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            const uvX = x / width
            const uvY = y / height

            // Distance from nearest edge (0 at edge, 0.5 at center)
            const distFromEdge = Math.min(
                uvX, 1.0 - uvX,
                uvY, 1.0 - uvY
            )

            // Hard edge border mask
            const mask = distFromEdge < borderSize ? 1.0 : 0.0
            const value = Math.floor(mask * 255)

            data[i + 0] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }
    }
    return createMaskTexture(gl, width, height, data)
}

// Center only - effect in center, none on border (hard edge)
export function createCenterMask(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)
    const borderLeft = 0.15
    const borderRight = 0.15
    const borderTop = 0.28    // Moved down ~30px
    const borderBottom = 0.23 // Made ~10px shorter

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            const uvX = x / width
            const uvY = y / height

            // Check if inside center area
            const insideCenter = uvX > borderLeft && uvX < (1.0 - borderRight) &&
                                 uvY > borderTop && uvY < (1.0 - borderBottom)

            // Hard edge center mask
            const mask = insideCenter ? 1.0 : 0.0
            const value = Math.floor(mask * 255)

            data[i + 0] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }
    }
    return createMaskTexture(gl, width, height, data)
}

// Art window - rectangular cutout where art would be (no effect), border has effect (hard edge)
export function createArtWindowMask(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)

    // Art window bounds (typical trading card layout)
    const artLeft = 0.10
    const artRight = 0.90
    const artTop = 0.23    // Moved down ~40px
    const artBottom = 0.94  // Moved down ~40px

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            const uvX = x / width
            const uvY = y / height

            // Check if inside art window
            const insideArtWindow = uvX > artLeft && uvX < artRight &&
                                    uvY > artTop && uvY < artBottom

            // Inside art window = 0 (no effect), outside = 1 (effect)
            const mask = insideArtWindow ? 0.0 : 1.0
            const value = Math.floor(mask * 255)

            data[i + 0] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }
    }
    return createMaskTexture(gl, width, height, data)
}

// Texture brightness mask - uses luminance of source texture as mask
export function createTextureBrightnessMask(gl, sourceCanvas) {
    const width = sourceCanvas.width
    const height = sourceCanvas.height
    const ctx = sourceCanvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, width, height)
    const pixels = imageData.data

    const data = new Uint8Array(width * height * 4)
    const contrastFactor = 2.0 // Double the contrast

    for (let i = 0; i < width * height; i++) {
        const r = pixels[i * 4 + 0]
        const g = pixels[i * 4 + 1]
        const b = pixels[i * 4 + 2]

        // Calculate luminance (perceived brightness)
        let luminance = 0.299 * r + 0.587 * g + 0.114 * b

        // Apply contrast: shift to center, multiply, shift back
        luminance = (luminance - 128) * contrastFactor + 128

        // Clamp to valid range
        luminance = Math.floor(Math.max(0, Math.min(255, luminance)))

        data[i * 4 + 0] = luminance
        data[i * 4 + 1] = luminance
        data[i * 4 + 2] = luminance
        data[i * 4 + 3] = 255
    }

    return createMaskTexture(gl, width, height, data)
}

// Radial gradient - effect stronger at edges, fades toward center
export function createRadialEdgeMask(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)
    const centerX = 0.5
    const centerY = 0.5

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            const uvX = x / width
            const uvY = y / height

            // Normalized distance from center (accounting for aspect ratio)
            const dx = (uvX - centerX) * 2.0
            const dy = (uvY - centerY) * 2.0 * (width / height)
            const dist = Math.sqrt(dx * dx + dy * dy)

            // Radial gradient: 0 at center, 1 at edges
            let mask = smoothstep(0.0, 1.0, dist)
            const value = Math.floor(mask * 255)

            data[i + 0] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }
    }
    return createMaskTexture(gl, width, height, data)
}

// Inverse radial - effect stronger at center, fades toward edges
export function createRadialCenterMask(gl, width = 256, height = 358) {
    const data = new Uint8Array(width * height * 4)
    const centerX = 0.5
    const centerY = 0.5

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4
            const uvX = x / width
            const uvY = y / height

            const dx = (uvX - centerX) * 2.0
            const dy = (uvY - centerY) * 2.0 * (width / height)
            const dist = Math.sqrt(dx * dx + dy * dy)

            // Inverse radial: 1 at center, 0 at edges
            let mask = 1.0 - smoothstep(0.0, 1.0, dist)
            const value = Math.floor(mask * 255)

            data[i + 0] = value
            data[i + 1] = value
            data[i + 2] = value
            data[i + 3] = 255
        }
    }
    return createMaskTexture(gl, width, height, data)
}

// Helper: smoothstep function
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}

// Helper: create texture from mask data
function createMaskTexture(gl, width, height, data) {
    const texture = new Texture(gl)
    texture.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    texture.width = width
    texture.height = height
    return texture
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
