/**
 * Wait for the card shader app to fully initialize
 */
export async function waitForApp(page) {
    await page.waitForFunction(() => {
        return window.cardApp &&
               window.cardApp.card &&
               window.cardApp.shaderManager &&
               window.cardApp.shaderManager.getActive()
    }, { timeout: 10000 })

    // Give WebGL a moment to render
    await page.waitForTimeout(100)
}

/**
 * Set card rotation programmatically and trigger render
 * Pauses the render loop to ensure deterministic screenshots
 */
export async function setRotation(page, x, y) {
    await page.evaluate(({ x, y }) => {
        const app = window.cardApp

        // Pause the render loop
        app.isRunning = false

        // Freeze time for deterministic rendering
        app.renderer.time = 0

        // Set rotation
        app.card.rotation.x = x
        app.card.rotation.y = y
        app.card.targetRotation.x = x
        app.card.targetRotation.y = y
        app.card.updateModelMatrix()

        // Render with controlled state
        app.bloomPass.beginSceneRender()
        app.context.clear()
        app.renderer.render(app.card, app.controller, 0, {
            hdrEnabled: false,
            saturationBoostEnabled: false,
            showMask: false,
            maskActive: true,
            isBaseShader: app.shaderManager.getActiveName() === 'base'
        })
        app.bloomPass.endSceneRender()
        app.bloomPass.renderBloom()
    }, { x, y })

    // Wait for render to complete
    await page.waitForTimeout(50)
}

/**
 * Select a shader by name
 */
export async function selectShader(page, shaderName) {
    await page.selectOption('#shader-select', shaderName)
    await page.waitForTimeout(50)
}

/**
 * Get canvas pixel data as array
 */
export async function getCanvasPixels(page) {
    return await page.evaluate(() => {
        const canvas = document.getElementById('card-canvas')
        const ctx = canvas.getContext('webgl2')

        const width = canvas.width
        const height = canvas.height
        const pixels = new Uint8Array(width * height * 4)

        ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels)

        return {
            data: Array.from(pixels),
            width,
            height
        }
    })
}

/**
 * Calculate percentage of pixels that differ between two images
 */
export function calculateDifference(pixels1, pixels2) {
    if (pixels1.data.length !== pixels2.data.length) {
        throw new Error('Pixel arrays must be same size')
    }

    let differentPixels = 0
    const totalPixels = pixels1.data.length / 4

    for (let i = 0; i < pixels1.data.length; i += 4) {
        const r1 = pixels1.data[i]
        const g1 = pixels1.data[i + 1]
        const b1 = pixels1.data[i + 2]

        const r2 = pixels2.data[i]
        const g2 = pixels2.data[i + 1]
        const b2 = pixels2.data[i + 2]

        // Consider pixels different if any channel differs by more than 5
        if (Math.abs(r1 - r2) > 5 || Math.abs(g1 - g2) > 5 || Math.abs(b1 - b2) > 5) {
            differentPixels++
        }
    }

    return differentPixels / totalPixels
}

/**
 * Get brightness at a specific UV coordinate (0-1 range)
 */
export function getBrightnessAt(pixels, u, v) {
    const x = Math.floor(u * pixels.width)
    // WebGL reads from bottom-left, so flip Y
    const y = Math.floor((1 - v) * pixels.height)
    const i = (y * pixels.width + x) * 4

    const r = pixels.data[i]
    const g = pixels.data[i + 1]
    const b = pixels.data[i + 2]

    // Return perceived brightness
    return (r * 0.299 + g * 0.587 + b * 0.114)
}

/**
 * Calculate color variance across the image (higher = more colors)
 */
export function getColorVariance(pixels) {
    let sumR = 0, sumG = 0, sumB = 0
    let sumR2 = 0, sumG2 = 0, sumB2 = 0
    const count = pixels.data.length / 4

    for (let i = 0; i < pixels.data.length; i += 4) {
        const r = pixels.data[i]
        const g = pixels.data[i + 1]
        const b = pixels.data[i + 2]

        sumR += r
        sumG += g
        sumB += b
        sumR2 += r * r
        sumG2 += g * g
        sumB2 += b * b
    }

    const varR = (sumR2 / count) - Math.pow(sumR / count, 2)
    const varG = (sumG2 / count) - Math.pow(sumG / count, 2)
    const varB = (sumB2 / count) - Math.pow(sumB / count, 2)

    return varR + varG + varB
}

/**
 * Check if pixel data contains a gradient (not solid color)
 */
export function hasGradient(pixels, minVariance = 100) {
    const variance = getColorVariance(pixels)
    return variance > minVariance
}

/**
 * Sample multiple points and check for brightness gradient
 */
export function hasBrightnessGradient(pixels, threshold = 20) {
    const center = getBrightnessAt(pixels, 0.5, 0.5)
    const topLeft = getBrightnessAt(pixels, 0.15, 0.15)
    const topRight = getBrightnessAt(pixels, 0.85, 0.15)
    const bottomLeft = getBrightnessAt(pixels, 0.15, 0.85)
    const bottomRight = getBrightnessAt(pixels, 0.85, 0.85)

    const edgeAvg = (topLeft + topRight + bottomLeft + bottomRight) / 4

    // Center should be brighter than edges for our depth map
    return (center - edgeAvg) > threshold
}
