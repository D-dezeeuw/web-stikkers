import { Texture } from '../core/Texture.js'
import { createTextureBrightnessMask } from '../core/MaskFactory.js'
import { CONFIG } from '../config.js'
import { COMMON_EMOJIS, COLOR_PALETTES, GEOMETRIC_TYPES } from '../data/emojis.js'

export class RandomTextureFactory {
    constructor(gl) {
        this.gl = gl
    }

    /**
     * Create a random card texture
     * @param {Object} options
     * @param {string} options.type - 'emoji' | 'geometric' | 'random' (default: 'random')
     * @param {number} options.borderWidth - Border width (default: 8)
     * @param {number} options.borderOffset - Border offset from edge (default: 15)
     * @param {string} options.emoji - Force specific emoji (optional)
     * @param {string} options.geometricType - Force specific geometric type (optional)
     * @param {string[]} options.palette - Force specific color palette (optional)
     * @returns {{ texture: Texture, canvas: HTMLCanvasElement, brightnessMask: Texture, generatedName: string }}
     */
    createRandomCard(options = {}) {
        const {
            type = 'random',
            borderWidth = 8,
            borderOffset = 15,
            emoji = null,
            geometricType = null,
            palette = null,
            noMask = false,
            name = null,
            collectionName = null
        } = options

        // Setup canvas with resolution scaling
        const scale = CONFIG.demo.resolutionScale
        const width = CONFIG.demo.baseWidth * scale
        const height = CONFIG.demo.baseHeight * scale
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        // Draw background gradient
        this._drawBackground(ctx, width, height)

        // Draw center content based on type
        const actualType = type === 'random'
            ? (Math.random() > 0.5 ? 'emoji' : 'geometric')
            : type

        // Determine collection name (use provided or default based on type)
        const defaultCollection = actualType === 'emoji' ? 'EMOJI' : 'GEOMETRY'
        const finalCollectionName = collectionName || defaultCollection

        // Draw borders (include card name in texture if noMask)
        const cardNameInTexture = noMask ? name : null
        this._drawBorders(ctx, width, height, borderWidth * scale, borderOffset * scale, scale, cardNameInTexture, finalCollectionName)

        let generatedName = ''
        if (actualType === 'emoji') {
            generatedName = this._drawEmoji(ctx, width, height, scale, emoji)
        } else {
            generatedName = this._drawGeometric(ctx, width, height, scale, geometricType, palette)
        }

        // Create texture from canvas
        const texture = new Texture(this.gl)
        texture.createFromImage(canvas)

        // Create brightness mask for effects
        const brightnessMask = createTextureBrightnessMask(this.gl, canvas)

        return { texture, canvas, brightnessMask, generatedName }
    }

    /**
     * Create multiple unique random cards
     * @param {number} count - Number of cards to create
     * @param {Object} options - Options passed to createRandomCard
     * @returns {Array<{ texture: Texture, canvas: HTMLCanvasElement, brightnessMask: Texture }>}
     */
    createMultipleCards(count, options = {}) {
        const cards = []
        const usedEmojis = new Set()

        for (let i = 0; i < count; i++) {
            let cardOptions = { ...options }

            // Ensure unique emojis if type is emoji
            if (options.type === 'emoji' || options.type === 'random') {
                let emoji
                let attempts = 0
                do {
                    emoji = this._pickRandom(COMMON_EMOJIS)
                    attempts++
                } while (usedEmojis.has(emoji) && attempts < 100)
                usedEmojis.add(emoji)

                if (options.type !== 'geometric') {
                    cardOptions.emoji = emoji
                    cardOptions.type = 'emoji'
                }
            }

            cards.push(this.createRandomCard(cardOptions))
        }

        return cards
    }

    _drawBackground(ctx, width, height) {
        const gradient = ctx.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, '#1a1a3e')
        gradient.addColorStop(0.5, '#2a2a5e')
        gradient.addColorStop(1, '#1a1a3e')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)
    }

    _drawBorders(ctx, width, height, borderWidth, borderOffset, scale, cardName = null, collectionName = 'CARD') {
        // Outer border
        ctx.strokeStyle = '#4a4a8e'
        ctx.lineWidth = borderWidth
        ctx.strokeRect(
            borderOffset,
            borderOffset + 30 * scale,
            width - borderOffset * 2,
            (height - 30 * scale) - borderOffset * 2
        )

        // Inner border (half thickness, close to outer border)
        ctx.strokeStyle = '#6a6aae'
        ctx.lineWidth = borderWidth / 2
        const innerOffset = borderOffset + borderWidth + 4 * scale
        ctx.strokeRect(
            innerOffset,
            innerOffset + 30 * scale,
            width - innerOffset * 2,
            (height - 30 * scale) - innerOffset * 2
        )

        // Collection name text at top
        ctx.fillStyle = '#ccccff'
        ctx.font = `bold ${14 * scale}px Arial`
        ctx.textAlign = 'left'
        ctx.fillText(collectionName, 10 * scale, 31 * scale)

        // Draw card name at bottom if provided (for noMask cards)
        if (cardName) {
            ctx.fillStyle = '#ffffff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'

            let fontSize = 32 * scale
            if (cardName.length > 10) fontSize = 24 * scale
            if (cardName.length > 15) fontSize = 20 * scale

            ctx.font = `bold ${fontSize}px Arial, sans-serif`
            ctx.fillText(cardName, width / 2, height * 0.88)
        }
    }

    _drawEmoji(ctx, width, height, scale, forcedEmoji = null) {
        // Handle both string emoji and object { emoji, name }
        let emojiChar = forcedEmoji
        let emojiName = ''
        if (!emojiChar) {
            const picked = this._pickRandom(COMMON_EMOJIS)
            emojiChar = picked.emoji || picked
            emojiName = picked.name || ''
        } else if (typeof emojiChar === 'object') {
            emojiName = emojiChar.name || ''
            emojiChar = emojiChar.emoji
        } else if (typeof emojiChar === 'string') {
            // Try to find the name from COMMON_EMOJIS
            const found = COMMON_EMOJIS.find(e => e.emoji === emojiChar)
            emojiName = found ? found.name : ''
        }

        // Draw emoji large in center
        const fontSize = 100 * scale
        ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Center position (accounting for header)
        const centerX = width / 2
        const centerY = height / 2 + 15 * scale  // Offset slightly for header

        ctx.fillText(emojiChar, centerX, centerY)

        // Add subtle glow effect
        ctx.shadowColor = 'rgba(255, 255, 255, 0.3)'
        ctx.shadowBlur = 20 * scale
        ctx.fillText(emojiChar, centerX, centerY)
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        return emojiName
    }

    _drawGeometric(ctx, width, height, scale, forcedType = null, forcedPalette = null) {
        const type = forcedType || this._pickRandom(GEOMETRIC_TYPES)
        const palette = forcedPalette || this._pickRandom(COLOR_PALETTES)

        const centerX = width / 2
        const centerY = height / 2 + 15 * scale

        ctx.save()

        switch (type) {
            case 'circles':
                this._drawCircles(ctx, centerX, centerY, scale, palette)
                break
            case 'triangles':
                this._drawTriangles(ctx, centerX, centerY, scale, palette)
                break
            case 'hexagons':
                this._drawHexagons(ctx, centerX, centerY, scale, palette)
                break
            case 'diamonds':
                this._drawDiamonds(ctx, centerX, centerY, scale, palette)
                break
            case 'stars':
                this._drawStars(ctx, centerX, centerY, scale, palette)
                break
            case 'squares':
                this._drawSquares(ctx, centerX, centerY, scale, palette)
                break
            case 'rings':
                this._drawRings(ctx, centerX, centerY, scale, palette)
                break
            case 'spirograph':
                this._drawSpirograph(ctx, centerX, centerY, scale, palette)
                break
        }

        ctx.restore()

        // Return capitalized type name
        return type.charAt(0).toUpperCase() + type.slice(1)
    }

    _drawCircles(ctx, cx, cy, scale, palette) {
        const sizes = [60, 45, 30, 20, 12]
        sizes.forEach((size, i) => {
            ctx.beginPath()
            ctx.arc(cx, cy, size * scale, 0, Math.PI * 2)
            ctx.fillStyle = palette[i % palette.length]
            ctx.fill()
        })
    }

    _drawTriangles(ctx, cx, cy, scale, palette) {
        for (let i = 0; i < 5; i++) {
            const size = (50 - i * 8) * scale
            const angle = (i * 15) * Math.PI / 180

            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate(angle)

            ctx.beginPath()
            ctx.moveTo(0, -size)
            ctx.lineTo(-size * 0.866, size * 0.5)
            ctx.lineTo(size * 0.866, size * 0.5)
            ctx.closePath()

            ctx.fillStyle = palette[i % palette.length]
            ctx.fill()
            ctx.restore()
        }
    }

    _drawHexagons(ctx, cx, cy, scale, palette) {
        const drawHex = (x, y, size, color) => {
            ctx.beginPath()
            for (let i = 0; i < 6; i++) {
                const angle = (i * 60 - 30) * Math.PI / 180
                const px = x + Math.cos(angle) * size
                const py = y + Math.sin(angle) * size
                if (i === 0) ctx.moveTo(px, py)
                else ctx.lineTo(px, py)
            }
            ctx.closePath()
            ctx.fillStyle = color
            ctx.fill()
        }

        // Center hexagon
        drawHex(cx, cy, 35 * scale, palette[0])

        // Surrounding hexagons
        const offset = 45 * scale
        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * Math.PI / 180
            const x = cx + Math.cos(angle) * offset
            const y = cy + Math.sin(angle) * offset
            drawHex(x, y, 20 * scale, palette[(i + 1) % palette.length])
        }
    }

    _drawDiamonds(ctx, cx, cy, scale, palette) {
        const sizes = [55, 40, 28, 18, 10]
        sizes.forEach((size, i) => {
            const s = size * scale
            ctx.beginPath()
            ctx.moveTo(cx, cy - s)
            ctx.lineTo(cx + s * 0.6, cy)
            ctx.lineTo(cx, cy + s)
            ctx.lineTo(cx - s * 0.6, cy)
            ctx.closePath()
            ctx.fillStyle = palette[i % palette.length]
            ctx.fill()
        })
    }

    _drawStars(ctx, cx, cy, scale, palette) {
        const drawStar = (x, y, outerR, innerR, points, color) => {
            ctx.beginPath()
            for (let i = 0; i < points * 2; i++) {
                const r = i % 2 === 0 ? outerR : innerR
                const angle = (i * Math.PI / points) - Math.PI / 2
                const px = x + Math.cos(angle) * r
                const py = y + Math.sin(angle) * r
                if (i === 0) ctx.moveTo(px, py)
                else ctx.lineTo(px, py)
            }
            ctx.closePath()
            ctx.fillStyle = color
            ctx.fill()
        }

        // Main star
        drawStar(cx, cy, 55 * scale, 25 * scale, 5, palette[0])
        drawStar(cx, cy, 35 * scale, 15 * scale, 5, palette[1])
        drawStar(cx, cy, 18 * scale, 8 * scale, 5, palette[2])
    }

    _drawSquares(ctx, cx, cy, scale, palette) {
        const sizes = [50, 38, 28, 20, 12]
        sizes.forEach((size, i) => {
            const s = size * scale
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate((i * 12) * Math.PI / 180)
            ctx.fillStyle = palette[i % palette.length]
            ctx.fillRect(-s, -s, s * 2, s * 2)
            ctx.restore()
        })
    }

    _drawRings(ctx, cx, cy, scale, palette) {
        const rings = [55, 45, 35, 25, 15]
        rings.forEach((r, i) => {
            ctx.beginPath()
            ctx.arc(cx, cy, r * scale, 0, Math.PI * 2)
            ctx.strokeStyle = palette[i % palette.length]
            ctx.lineWidth = 6 * scale
            ctx.stroke()
        })
    }

    _drawSpirograph(ctx, cx, cy, scale, palette) {
        const R = 40 * scale  // outer radius
        const r = 15 * scale  // inner radius
        const d = 25 * scale  // pen distance

        ctx.beginPath()
        for (let t = 0; t < Math.PI * 20; t += 0.05) {
            const x = cx + (R - r) * Math.cos(t) + d * Math.cos((R - r) / r * t)
            const y = cy + (R - r) * Math.sin(t) - d * Math.sin((R - r) / r * t)
            if (t === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }

        const gradient = ctx.createLinearGradient(cx - 60 * scale, cy, cx + 60 * scale, cy)
        palette.forEach((color, i) => {
            gradient.addColorStop(i / (palette.length - 1), color)
        })

        ctx.strokeStyle = gradient
        ctx.lineWidth = 2 * scale
        ctx.stroke()
    }

    _pickRandom(array) {
        return array[Math.floor(Math.random() * array.length)]
    }
}
