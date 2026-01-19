import { WebGLContext } from './core/WebGLContext.js'
import { Geometry } from './core/Geometry.js'
import {
    Texture,
    createRainbowGradient,
    createNoiseTexture,
    createFoilPattern,
    createDepthMap,
    createFullMask,
    createBorderMask,
    createCenterMask,
    createArtWindowMask,
    createRadialEdgeMask,
    createRadialCenterMask,
    createTextureBrightnessMask
} from './core/Texture.js'
import { ShaderManager } from './shaders/ShaderManager.js'
import { Card } from './card/Card.js'
import { CardController } from './card/CardController.js'
import { CardRenderer } from './card/CardRenderer.js'
import { BloomPass } from './post/BloomPass.js'

class CardShaderApp {
    constructor() {
        this.canvas = document.getElementById('card-canvas')
        this.cardSelect = document.getElementById('card-select')
        this.shaderSelect = document.getElementById('shader-select')
        this.maskSelect = document.getElementById('mask-select')
        this.hdrToggle = document.getElementById('hdr-toggle')
        this.saturationToggle = document.getElementById('saturation-toggle')
        this.bloomToggle = document.getElementById('bloom-toggle')
        this.showMaskToggle = document.getElementById('show-mask-toggle')
        this.cardTextInput = document.getElementById('card-text')
        this.cardNumberInput = document.getElementById('card-number')

        // Effect settings
        this.hdrEnabled = false
        this.saturationBoostEnabled = false
        this.showMask = false
        this.maskActive = true  // True when using a real mask (not "full")
        this.cardText = ''
        this.cardNumber = ''
        this.textTexture = null
        this.numberTexture = null

        this.gl = null
        this.context = null
        this.geometry = null
        this.shaderManager = null
        this.card = null
        this.controller = null
        this.renderer = null
        this.bloomPass = null

        this.lastTime = 0
        this.isRunning = false
    }

    async init() {
        // Initialize WebGL
        this.context = new WebGLContext(this.canvas)
        this.gl = this.context.init()

        // Scale canvas to fit viewport then update WebGL buffer
        this.updateCanvasSize()
        this.context.resize()

        // Create geometry (5:8 ratio = 1:1.6)
        this.geometry = new Geometry(this.gl)
        this.geometry.createQuad(1, 1.6)

        // Create shader manager and load shaders
        this.shaderManager = new ShaderManager(this.gl)
        await this.loadShaders()

        // Create card
        this.card = new Card({
            scaleX: 1,
            scaleY: 1,
            smoothing: 8
        })

        // Create procedural textures
        this.card.setTexture('rainbow', createRainbowGradient(this.gl))
        this.card.setTexture('noise', createNoiseTexture(this.gl))
        this.card.setTexture('foil', createFoilPattern(this.gl))
        this.card.setTexture('depth', createDepthMap(this.gl))

        // Create effect mask textures
        this.effectMasks = {
            'full': createFullMask(this.gl),
            'border': createBorderMask(this.gl),
            'center': createCenterMask(this.gl),
            'art-window': createArtWindowMask(this.gl),
            'radial-edge': createRadialEdgeMask(this.gl),
            'radial-center': createRadialCenterMask(this.gl)
        }
        // Set default mask (full effect everywhere)
        this.card.setTexture('effectMask', this.effectMasks['full'])

        // Load zelda card textures
        await this.loadCardTextures()

        // Initialize text texture with default values
        this.cardText = this.cardTextInput.value || 'Link'
        this.cardNumber = this.cardNumberInput.value || '69/321'
        this.createTextTexture()

        // Create controller and renderer
        this.controller = new CardController(this.card, this.canvas)
        this.renderer = new CardRenderer(this.gl, this.geometry, this.shaderManager)

        // Create bloom pass
        this.bloomPass = new BloomPass(this.gl)
        await this.bloomPass.loadShaders()
        this.bloomPass.resize(this.canvas.width, this.canvas.height)

        // Set initial shader and mask
        this.shaderManager.use('foil')
        const zeldaCard = this.cards['zelda']
        this.card.setTexture('base', zeldaCard.texture)
        this.card.setTexture('effectMask', zeldaCard.normalMap || zeldaCard.brightnessMask)
        this.maskActive = true  // Normal map mask active

        // Ensure dropdowns match initial state
        this.cardSelect.value = 'zelda'
        this.shaderSelect.value = 'foil'
        this.maskSelect.value = 'normal-map'

        // Setup event listeners
        this.setupEvents()

        // Start render loop
        this.isRunning = true
        this.lastTime = performance.now()
        this.render()
    }

    async loadShaders() {
        const baseVertPath = 'src/shaders/base/base.vert.glsl'

        await Promise.all([
            this.shaderManager.loadShader('base', baseVertPath, 'src/shaders/base/base.frag.glsl'),
            this.shaderManager.loadShader('holographic', baseVertPath, 'src/shaders/holographic/holographic.frag.glsl'),
            this.shaderManager.loadShader('foil', baseVertPath, 'src/shaders/foil/foil.frag.glsl'),
            this.shaderManager.loadShader('parallax', baseVertPath, 'src/shaders/parallax/parallax.frag.glsl'),
            this.shaderManager.loadShader('cracked-ice', baseVertPath, 'src/shaders/cracked-ice/cracked-ice.frag.glsl'),
            this.shaderManager.loadShader('refractor', baseVertPath, 'src/shaders/refractor/refractor.frag.glsl'),
            this.shaderManager.loadShader('galaxy', baseVertPath, 'src/shaders/galaxy/galaxy.frag.glsl'),
            this.shaderManager.loadShader('starburst', baseVertPath, 'src/shaders/starburst/starburst.frag.glsl'),
            this.shaderManager.loadShader('prizm', baseVertPath, 'src/shaders/prizm/prizm.frag.glsl')
        ])
    }

    async loadCardTextures() {
        // Store all card data
        this.cards = {}

        // Load zelda card
        const zeldaVisual = new Texture(this.gl)
        await zeldaVisual.load('src/textures/zelda/visual.png')
        const zeldaNormal = new Texture(this.gl)
        await zeldaNormal.load('src/textures/zelda/normal.png')
        // Also create brightness mask from zelda visual
        const zeldaBrightness = await this.createBrightnessMaskFromImage('src/textures/zelda/visual.png')
        this.cards['zelda'] = {
            texture: zeldaVisual,
            normalMap: zeldaNormal,
            brightnessMask: zeldaBrightness
        }

        // Create demo cards (no normal map, only brightness mask)
        const demoThin = this.createDemoCardTexture(2, 20)
        this.cards['demo-thin'] = {
            texture: demoThin.texture,
            normalMap: null,
            brightnessMask: createTextureBrightnessMask(this.gl, demoThin.canvas)
        }
        const demoThick = this.createDemoCardTexture(8, 15)
        this.cards['demo-thick'] = {
            texture: demoThick.texture,
            normalMap: null,
            brightnessMask: createTextureBrightnessMask(this.gl, demoThick.canvas)
        }

        // Default textures will be set in init() after all cards are loaded
    }

    async createBrightnessMaskFromImage(url) {
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
        // Balanced resolution (2x base resolution)
        const scale = 2
        const width = 250 * scale
        const height = 400 * scale
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

    createTextTexture() {
        // Balanced resolution (2x base resolution)
        const width = 500
        const height = 800

        // Create name texture (for effect mask - shader effects apply to this)
        const nameCanvas = document.createElement('canvas')
        nameCanvas.width = width
        nameCanvas.height = height
        const nameCtx = nameCanvas.getContext('2d')
        nameCtx.clearRect(0, 0, width, height)

        if (this.cardText && this.cardText.trim()) {
            nameCtx.fillStyle = '#ffffff'
            nameCtx.textAlign = 'center'
            nameCtx.textBaseline = 'middle'

            // Scale font sizes by 2x for balanced res
            let fontSize = 64
            if (this.cardText.length > 10) fontSize = 48
            if (this.cardText.length > 15) fontSize = 40

            nameCtx.font = `bold ${fontSize}px Arial, sans-serif`
            nameCtx.fillText(this.cardText, width / 2, height * 0.85)
        }

        if (!this.textTexture) {
            this.textTexture = new Texture(this.gl)
        }
        this.textTexture.createFromImage(nameCanvas)
        this.card.setTexture('text', this.textTexture)

        // Create number texture (overlay only - no shader effects)
        const numberCanvas = document.createElement('canvas')
        numberCanvas.width = width
        numberCanvas.height = height
        const numberCtx = numberCanvas.getContext('2d')
        numberCtx.clearRect(0, 0, width, height)

        if (this.cardNumber && this.cardNumber.trim()) {
            numberCtx.fillStyle = '#ffffff'
            numberCtx.textAlign = 'right'
            numberCtx.textBaseline = 'top'
            // Scale font size by 2x for balanced res
            numberCtx.font = 'bold 28px Arial, sans-serif'
            numberCtx.fillText(this.cardNumber, width * 0.92, height * 0.05)
        }

        if (!this.numberTexture) {
            this.numberTexture = new Texture(this.gl)
        }
        this.numberTexture.createFromImage(numberCanvas)
        this.card.setTexture('number', this.numberTexture)
    }

    setupEvents() {
        // Card select
        this.cardSelect.addEventListener('change', (e) => {
            const cardData = this.cards[e.target.value]
            if (cardData) {
                this.card.setTexture('base', cardData.texture)
                // Update mask based on current mask selection
                const maskValue = this.maskSelect.value
                if (maskValue === 'normal-map') {
                    // Use normal map if available, otherwise fall back to brightness
                    const mask = cardData.normalMap || cardData.brightnessMask
                    if (mask) this.card.setTexture('effectMask', mask)
                } else if (maskValue === 'texture-brightness') {
                    if (cardData.brightnessMask) {
                        this.card.setTexture('effectMask', cardData.brightnessMask)
                    }
                }
            }
        })

        // Shader select
        this.shaderSelect.addEventListener('change', (e) => {
            this.shaderManager.use(e.target.value)
        })

        // Mask select
        this.maskSelect.addEventListener('change', (e) => {
            // Track if a real mask is active (not "full")
            this.maskActive = e.target.value !== 'full'

            const selectedCard = this.cardSelect.value
            const cardData = this.cards[selectedCard]

            if (e.target.value === 'normal-map') {
                // Use normal map if available, otherwise fall back to brightness
                if (cardData) {
                    const mask = cardData.normalMap || cardData.brightnessMask
                    if (mask) this.card.setTexture('effectMask', mask)
                }
            } else if (e.target.value === 'texture-brightness') {
                // Use brightness mask derived from texture
                if (cardData && cardData.brightnessMask) {
                    this.card.setTexture('effectMask', cardData.brightnessMask)
                }
            } else {
                const maskTexture = this.effectMasks[e.target.value]
                if (maskTexture) {
                    this.card.setTexture('effectMask', maskTexture)
                }
            }
        })

        // Effect toggles
        this.hdrToggle.addEventListener('change', (e) => {
            this.hdrEnabled = e.target.checked
        })

        this.saturationToggle.addEventListener('change', (e) => {
            this.saturationBoostEnabled = e.target.checked
        })

        this.bloomToggle.addEventListener('change', (e) => {
            this.bloomPass.enabled = e.target.checked
        })

        this.showMaskToggle.addEventListener('change', (e) => {
            this.showMask = e.target.checked
        })

        // Text inputs
        this.cardTextInput.addEventListener('input', (e) => {
            this.cardText = e.target.value
            this.createTextTexture()
        })

        this.cardNumberInput.addEventListener('input', (e) => {
            this.cardNumber = e.target.value
            this.createTextTexture()
        })

        // Resize
        window.addEventListener('resize', () => {
            this.updateCanvasSize()
            this.context.resize()
            this.renderer.updateProjection(this.context.getAspectRatio())
            this.bloomPass.resize(this.canvas.width, this.canvas.height)
        })

        // Initial projection setup
        this.renderer.updateProjection(this.context.getAspectRatio())
    }

    updateCanvasSize() {
        // Get available viewport height with some padding
        const padding = 40
        const availableHeight = window.innerHeight - padding

        // Maintain 5:8 aspect ratio (width:height)
        const aspectRatio = 5 / 8
        const height = availableHeight
        const width = height * aspectRatio

        // Only set CSS display size - let WebGLContext.resize() handle the buffer
        this.canvas.style.width = `${width}px`
        this.canvas.style.height = `${height}px`
    }

    render() {
        if (!this.isRunning) return

        const currentTime = performance.now()
        const deltaTime = (currentTime - this.lastTime) / 1000
        this.lastTime = currentTime

        // Update controller (handles idle animation)
        this.controller.update(deltaTime)

        // Update card
        this.card.update(deltaTime)

        // Begin bloom render pass (renders to framebuffer if enabled)
        this.bloomPass.beginSceneRender()

        // Clear and render
        this.context.clear()
        this.renderer.render(this.card, this.controller, deltaTime, {
            hdrEnabled: this.hdrEnabled,
            saturationBoostEnabled: this.saturationBoostEnabled,
            showMask: this.showMask,
            maskActive: this.maskActive,
            isBaseShader: this.shaderManager.getActiveName() === 'base'
        })

        // End scene render and apply bloom
        this.bloomPass.endSceneRender()
        this.bloomPass.renderBloom()

        requestAnimationFrame(() => this.render())
    }

    destroy() {
        this.isRunning = false
        this.controller?.destroy()
        this.shaderManager?.destroy()
        this.geometry?.destroy()
        this.bloomPass?.destroy()
    }
}

// Start the app
const app = new CardShaderApp()
app.init().catch(console.error)

// Expose app globally for testing
window.cardApp = app
