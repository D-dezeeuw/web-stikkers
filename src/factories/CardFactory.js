import { Texture } from '../core/Texture.js'
import { createTextureBrightnessMask } from '../core/MaskFactory.js'
import { CONFIG } from '../config.js'

export class CardFactory {
    constructor(gl) {
        this.gl = gl
    }

    async loadCardTextures() {
        const cards = {}

        // Load zelda card
        const zeldaVisual = new Texture(this.gl)
        await zeldaVisual.load('src/textures/zelda/visual.png')
        const zeldaNormal = new Texture(this.gl)
        await zeldaNormal.load('src/textures/zelda/normal.png')
        // Also create brightness mask from zelda visual
        const zeldaBrightness = await this.createBrightnessMaskFromImage('src/textures/zelda/visual.png')
        cards['zelda'] = {
            texture: zeldaVisual,
            normalMap: zeldaNormal,
            brightnessMask: zeldaBrightness
        }

        // Create demo cards (no normal map, only brightness mask)
        const demoThin = this.createDemoCardTexture(2, 20)
        cards['demo-thin'] = {
            texture: demoThin.texture,
            normalMap: null,
            brightnessMask: createTextureBrightnessMask(this.gl, demoThin.canvas)
        }
        const demoThick = this.createDemoCardTexture(8, 15)
        cards['demo-thick'] = {
            texture: demoThick.texture,
            normalMap: null,
            brightnessMask: createTextureBrightnessMask(this.gl, demoThick.canvas)
        }

        return cards
    }

    createBrightnessMaskFromImage(url) {
        return new Promise((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)
                resolve(createTextureBrightnessMask(this.gl, canvas))
            }
            img.src = url
        })
    }

    createDemoCardTexture(borderWidth, borderOffset) {
        // Use configured resolution scale
        const scale = CONFIG.demo.resolutionScale
        const width = CONFIG.demo.baseWidth * scale
        const height = CONFIG.demo.baseHeight * scale
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        // Scale input parameters
        borderWidth *= scale
        borderOffset *= scale

        // Dark gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height)
        gradient.addColorStop(0, '#1a1a3e')
        gradient.addColorStop(0.5, '#2a2a5e')
        gradient.addColorStop(1, '#1a1a3e')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, width, height)

        // Border
        ctx.strokeStyle = '#4a4a8e'
        ctx.lineWidth = borderWidth
        ctx.strokeRect(borderOffset, borderOffset + 30 * scale, width - borderOffset * 2, (height - 30 * scale) - borderOffset * 2)

        // Inner border (half thickness, close to outer border)
        ctx.strokeStyle = '#6a6aae'
        ctx.lineWidth = borderWidth / 2
        const innerOffset = borderOffset + borderWidth + 4 * scale
        ctx.strokeRect(innerOffset, innerOffset + 30 * scale, width - innerOffset * 2, (height - 30 * scale) - innerOffset * 2)

        // Central circle
        ctx.beginPath()
        ctx.arc(width / 2, height / 2, 50 * scale, 0, Math.PI * 2)
        ctx.strokeStyle = '#8a8ace'
        ctx.lineWidth = borderWidth + 1 * scale
        ctx.stroke()

        // Star pattern
        ctx.beginPath()
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2
            const x = width / 2 + Math.cos(angle) * 35 * scale
            const y = height / 2 + Math.sin(angle) * 35 * scale
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.strokeStyle = '#aaaaee'
        ctx.lineWidth = borderWidth
        ctx.stroke()

        // Text
        ctx.fillStyle = '#ccccff'
        ctx.font = `bold ${14 * scale}px Arial`
        ctx.textAlign = 'left'
        ctx.fillText('CARD', 10 * scale, 31 * scale)

        // Create texture from canvas
        const texture = new Texture(this.gl)
        texture.createFromImage(canvas)
        return { texture, canvas }
    }
}
