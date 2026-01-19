import { Texture } from './Texture.js'
import { CONFIG } from '../config.js'

// Helper: smoothstep function
function smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
}

// No mask - full effect everywhere
export function createFullMask(gl, width = CONFIG.textures.maskWidth, height = CONFIG.textures.maskHeight) {
    const data = new Uint8Array(width * height * 4)
    for (let i = 0; i < width * height; i++) {
        data[i * 4 + 0] = 255
        data[i * 4 + 1] = 255
        data[i * 4 + 2] = 255
        data[i * 4 + 3] = 255
    }
    return new Texture(gl).createFromData(width, height, data)
}

// Border only - effect on border, none in center (hard edge)
export function createBorderMask(gl, width = CONFIG.textures.maskWidth, height = CONFIG.textures.maskHeight) {
    const data = new Uint8Array(width * height * 4)
    const borderSize = CONFIG.masks.borderThickness

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
    return new Texture(gl).createFromData(width, height, data)
}

// Center only - effect in center, none on border (hard edge)
export function createCenterMask(gl, width = CONFIG.textures.maskWidth, height = CONFIG.textures.maskHeight) {
    const data = new Uint8Array(width * height * 4)
    const { left: borderLeft, right: borderRight, top: borderTop, bottom: borderBottom } = CONFIG.masks.center

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
    return new Texture(gl).createFromData(width, height, data)
}

// Art window - rectangular cutout where art would be (no effect), border has effect (hard edge)
export function createArtWindowMask(gl, width = CONFIG.textures.maskWidth, height = CONFIG.textures.maskHeight) {
    const data = new Uint8Array(width * height * 4)

    // Art window bounds (typical trading card layout)
    const { left: artLeft, right: artRight, top: artTop, bottom: artBottom } = CONFIG.masks.artWindow

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
    return new Texture(gl).createFromData(width, height, data)
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

    return new Texture(gl).createFromData(width, height, data)
}

// Radial gradient - effect stronger at edges, fades toward center
export function createRadialEdgeMask(gl, width = CONFIG.textures.maskWidth, height = CONFIG.textures.maskHeight) {
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
    return new Texture(gl).createFromData(width, height, data)
}

// Inverse radial - effect stronger at center, fades toward edges
export function createRadialCenterMask(gl, width = CONFIG.textures.maskWidth, height = CONFIG.textures.maskHeight) {
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
    return new Texture(gl).createFromData(width, height, data)
}
