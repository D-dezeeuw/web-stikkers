import { Geometry } from './core/Geometry.js'
import { createRainbowGradient, createNoiseTexture, createFoilPattern, createDepthMap } from './core/ProceduralTextures.js'
import { createFullMask } from './core/MaskFactory.js'
import { ShaderManager } from './shaders/ShaderManager.js'
import { Card } from './card/Card.js'
import { CardController } from './card/CardController.js'
import { CardRenderer } from './card/CardRenderer.js'
import { CardFactory } from './factories/CardFactory.js'
import { TextRenderer } from './factories/TextRenderer.js'

class LazyCardApp {
    constructor(canvas, shaderName, cardNumber, cardType) {
        this.canvas = canvas
        this.shaderName = shaderName
        this.cardNumber = cardNumber
        this.cardType = cardType

        // Create static image overlay (styled via CSS)
        this.staticImage = document.createElement('img')
        this.canvas.parentElement.appendChild(this.staticImage)

        // State
        this.isActive = false
        this.isInitializing = false
        this.isRunning = false
        this.lastTime = 0
        this.gl = null

        // Bind events (on card-cell for grid cards, or parent for overlay)
        const hoverTarget = this.canvas.closest('.card-cell') || this.canvas.parentElement
        hoverTarget.addEventListener('mouseenter', () => this.activate())
        hoverTarget.addEventListener('mouseleave', () => this.deactivate())
    }

    async renderStaticFrame() {
        // Temporarily set active for initialization
        this.isActive = true

        // Initialize just to render one frame
        await this.initWebGL()

        // Render a few frames to ensure everything is loaded
        for (let i = 0; i < 3; i++) {
            this.renderFrame(0.016)
            await new Promise(r => setTimeout(r, 16))
        }

        // Capture snapshot
        this.captureSnapshot()

        // Mark inactive and destroy
        this.isActive = false
        this.destroyWebGL()
    }

    async initWebGL() {
        if (this.gl) return // Already initialized

        // Get size from parent (canvas may be hidden)
        const parent = this.canvas.parentElement
        const rect = parent.getBoundingClientRect()
        const width = rect.width || 200
        const height = rect.height || 320
        const dpr = window.devicePixelRatio || 1

        // Set canvas size BEFORE init to avoid 0-size issues
        this.canvas.width = width * dpr
        this.canvas.height = height * dpr

        // Initialize WebGL
        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        })

        if (!this.gl) {
            throw new Error('Failed to create WebGL context')
        }

        // Configure GL state
        const gl = this.gl
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LEQUAL)
        gl.clearColor(0, 0, 0, 0)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)

        // Create geometry
        this.geometry = new Geometry(this.gl)
        this.geometry.createQuad(1, 1.6)

        // Create shader manager and load shaders
        this.shaderManager = new ShaderManager(this.gl)
        await this.loadShaders()

        // Check if deactivated during async operation - cleanup partial state
        if (!this.isActive) {
            this.cleanupPartialInit()
            return
        }

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
        this.card.setTexture('effectMask', createFullMask(this.gl))

        // Load card texture
        this.cardFactory = new CardFactory(this.gl)
        const cards = await this.cardFactory.loadCardTextures()

        // Check if deactivated during async operation - cleanup partial state
        if (!this.isActive) {
            this.cleanupPartialInit()
            return
        }

        const cardData = cards[this.cardType]
        this.card.setTexture('base', cardData.texture)
        if (this.cardType === 'zelda') {
            this.card.setTexture('effectMask', cardData.normalMap || cardData.brightnessMask)
        }

        // Create text textures
        this.textRenderer = new TextRenderer(this.gl)
        const cardName = this.cardType === 'zelda' ? 'Link' : 'Demo'
        this.textRenderer.createTextTextures(cardName, this.cardNumber, this.card)

        // Create controller and renderer
        this.controller = new CardController(this.card, this.canvas)
        this.renderer = new CardRenderer(this.gl, this.geometry, this.shaderManager)
        this.renderer.updateProjection(this.canvas.width / this.canvas.height)

        // Set shader
        this.shaderManager.use(this.shaderName)
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
            this.shaderManager.loadShader('prizm', baseVertPath, 'src/shaders/prizm/prizm.frag.glsl'),
            this.shaderManager.loadShader('etched', baseVertPath, 'src/shaders/etched/etched.frag.glsl')
        ])
    }

    captureSnapshot() {
        // Capture canvas to image
        this.staticImage.src = this.canvas.toDataURL('image/png')
        this.staticImage.style.display = 'block'
        this.canvas.style.display = 'none'
    }

    cleanupPartialInit() {
        // Clean up any partially initialized resources
        this.shaderManager?.destroy()
        this.geometry?.destroy()
        this.textRenderer?.destroy()
        this.controller?.destroy()

        this.gl = null
        this.geometry = null
        this.shaderManager = null
        this.card = null
        this.controller = null
        this.renderer = null
        this.cardFactory = null
        this.textRenderer = null
    }

    showCanvas() {
        this.staticImage.style.display = 'none'
        this.canvas.style.display = 'block'
    }

    destroyWebGL() {
        if (!this.gl) return

        // Clean up resources
        this.controller?.destroy()
        this.shaderManager?.destroy()
        this.geometry?.destroy()
        this.textRenderer?.destroy()

        // Clear references - browser will reclaim context when needed
        this.gl = null
        this.geometry = null
        this.shaderManager = null
        this.card = null
        this.controller = null
        this.renderer = null
        this.cardFactory = null
        this.textRenderer = null

        // Reset canvas to allow fresh context
        const parent = this.canvas.parentElement
        const oldCanvas = this.canvas
        const newCanvas = document.createElement('canvas')
        newCanvas.id = oldCanvas.id
        newCanvas.style.display = 'none'
        parent.replaceChild(newCanvas, oldCanvas)
        this.canvas = newCanvas
    }

    async activate() {
        if (this.isActive || this.isInitializing) return
        this.isActive = true
        this.isInitializing = true

        try {
            // Initialize WebGL
            await this.initWebGL()

            // Check if deactivated during init
            if (!this.isActive) {
                this.isInitializing = false
                return
            }

            this.showCanvas()

            // Start render loop
            this.isRunning = true
            this.lastTime = performance.now()
            this.renderLoop()
        } catch (err) {
            console.error(`Failed to activate card ${this.cardNumber}:`, err)
            this.isActive = false
        } finally {
            this.isInitializing = false
        }
    }

    deactivate() {
        if (!this.isActive) return
        this.isActive = false
        this.isRunning = false

        // If still initializing, just mark as inactive - initWebGL will check and bail out
        if (this.isInitializing) return

        // Capture final state
        if (this.gl) {
            this.captureSnapshot()
            this.destroyWebGL()
        }
    }

    renderFrame(deltaTime) {
        if (!this.gl) return

        this.card.update(deltaTime)
        this.controller?.update(deltaTime)

        const effectSettings = {
            hdrEnabled: false,
            saturationBoostEnabled: false,
            showMask: false,
            maskActive: false,
            isBaseShader: this.shaderName === 'base'
        }

        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0.1, 0.1, 0.15, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.disable(gl.BLEND)

        this.renderer.render(this.card, this.controller, deltaTime, effectSettings)
    }

    renderLoop() {
        if (!this.isRunning || !this.gl) return

        const currentTime = performance.now()
        const deltaTime = (currentTime - this.lastTime) / 1000
        this.lastTime = currentTime

        this.renderFrame(deltaTime)

        requestAnimationFrame(() => this.renderLoop())
    }
}

// Shader list
const shaders = [
    'holographic', 'foil', 'prizm', 'galaxy', 'cracked-ice',
    'refractor', 'starburst', 'etched', 'parallax', 'base'
]

// Overlay card manager
class OverlayManager {
    constructor() {
        this.overlay = document.getElementById('overlay')
        this.canvas = document.getElementById('overlay-canvas')
        this.cardApp = null
        this.isOpen = false

        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay || e.target.closest('.overlay-card')) {
                this.close()
            }
        })
    }

    async open(shaderName, cardNumber, cardType) {
        if (this.isOpen) return
        this.isOpen = true

        // Show overlay
        this.overlay.classList.add('active')

        // Create a new card app for the overlay
        this.cardApp = new LazyCardApp(this.canvas, shaderName, cardNumber, cardType)

        // Override the static image creation since overlay doesn't need it
        this.cardApp.staticImage.style.display = 'none'

        // Activate immediately
        await this.cardApp.activate()
    }

    close() {
        if (!this.isOpen) return
        this.isOpen = false

        // Hide overlay
        this.overlay.classList.remove('active')

        // Cleanup card app (stop rendering but don't let it replace canvas)
        if (this.cardApp) {
            this.cardApp.isActive = false
            this.cardApp.isRunning = false
            this.cardApp.controller?.destroy()
            this.cardApp.shaderManager?.destroy()
            this.cardApp.geometry?.destroy()
            this.cardApp.textRenderer?.destroy()
            this.cardApp = null
        }

        // Clear overlay-card completely and create fresh canvas
        const overlayCard = this.overlay.querySelector('.overlay-card')
        overlayCard.innerHTML = ''
        const newCanvas = document.createElement('canvas')
        newCanvas.id = 'overlay-canvas'
        overlayCard.appendChild(newCanvas)
        this.canvas = newCanvas
    }
}

async function initGrid() {
    // Wait for layout
    await new Promise(r => setTimeout(r, 100))

    const cards = []
    const overlayManager = new OverlayManager()

    // Create all 20 card instances
    for (let i = 0; i < 20; i++) {
        const canvas = document.getElementById(`card-${i}`)
        const cardType = i < 10 ? 'zelda' : 'demo-thick'
        const shaderIndex = i % 10
        const cardNumber = `${String(i + 1).padStart(3, '0')}/020`

        const app = new LazyCardApp(canvas, shaders[shaderIndex], cardNumber, cardType)
        cards.push(app)

        // Add click handler to open overlay (on the card-cell)
        const cardCell = canvas.closest('.card-cell')
        cardCell.addEventListener('click', () => {
            overlayManager.open(shaders[shaderIndex], cardNumber, cardType)
        })
    }

    // Render static frames sequentially (to avoid context limit)
    for (let i = 0; i < cards.length; i++) {
        await cards[i].renderStaticFrame()
    }
}

initGrid().catch(console.error)
