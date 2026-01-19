import { WebGLContext } from './core/WebGLContext.js'
import { Geometry } from './core/Geometry.js'
import { createRainbowGradient, createNoiseTexture, createFoilPattern, createDepthMap } from './core/ProceduralTextures.js'
import { createFullMask, createBorderMask, createCenterMask, createArtWindowMask, createRadialEdgeMask, createRadialCenterMask } from './core/MaskFactory.js'
import { ShaderManager } from './shaders/ShaderManager.js'
import { CONFIG } from './config.js'
import { Card } from './card/Card.js'
import { CardController } from './card/CardController.js'
import { CardRenderer } from './card/CardRenderer.js'
import { BloomPass } from './post/BloomPass.js'
import { EffectsPass } from './post/EffectsPass.js'
import { UIController } from './ui/UIController.js'
import { TextRenderer } from './factories/TextRenderer.js'
import { CardFactory } from './factories/CardFactory.js'

class CardShaderApp {
    constructor() {
        this.canvas = document.getElementById('card-canvas')

        // Effect settings
        this.hdrEnabled = false
        this.saturationBoostEnabled = false
        this.showMask = false
        this.maskActive = true
        this.cardText = ''
        this.cardNumber = ''

        this.gl = null
        this.context = null
        this.geometry = null
        this.shaderManager = null
        this.card = null
        this.controller = null
        this.renderer = null
        this.bloomPass = null
        this.effectsPass = null
        this.uiController = null
        this.textRenderer = null
        this.cardFactory = null
        this.cards = {}
        this.effectMasks = {}

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
        this.card.setTexture('effectMask', this.effectMasks['full'])

        // Load card textures using factory
        this.cardFactory = new CardFactory(this.gl)
        this.cards = await this.cardFactory.loadCardTextures()

        // Initialize text renderer
        this.textRenderer = new TextRenderer(this.gl)
        this.cardText = document.getElementById('card-text').value || 'Link'
        this.cardNumber = document.getElementById('card-number').value || '69/321'
        this.textRenderer.createTextTextures(this.cardText, this.cardNumber, this.card)

        // Create controller and renderer
        this.controller = new CardController(this.card, this.canvas)
        this.renderer = new CardRenderer(this.gl, this.geometry, this.shaderManager)

        // Create effects pass (HDR, saturation, number overlay)
        this.effectsPass = new EffectsPass(this.gl)
        await this.effectsPass.loadShader()
        this.effectsPass.resize(this.canvas.width, this.canvas.height)

        // Create bloom pass
        this.bloomPass = new BloomPass(this.gl)
        await this.bloomPass.loadShaders()
        this.bloomPass.resize(this.canvas.width, this.canvas.height)
        // Bloom outputs to effects pass framebuffer
        this.bloomPass.setOutputFBO(this.effectsPass.sceneFBO.fbo)
        this.bloomPass.enabled = true  // Enable bloom by default

        // Set initial shader and mask
        this.shaderManager.use('holographic')
        const zeldaCard = this.cards['zelda']
        this.card.setTexture('base', zeldaCard.texture)
        this.card.setTexture('effectMask', zeldaCard.normalMap || zeldaCard.brightnessMask)
        this.maskActive = true

        // Setup UI controller and event listeners
        this.uiController = new UIController(this)
        this.uiController.syncInitialState()
        this.uiController.setupEventListeners()

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
            this.shaderManager.loadShader('prizm', baseVertPath, 'src/shaders/prizm/prizm.frag.glsl'),
            this.shaderManager.loadShader('etched', baseVertPath, 'src/shaders/etched/etched.frag.glsl')
        ])
    }

    updateCanvasSize() {
        const padding = 40
        const availableHeight = window.innerHeight - padding
        const aspectRatio = CONFIG.card.aspectRatio
        const height = availableHeight
        const width = height * aspectRatio

        this.canvas.style.width = `${width}px`
        this.canvas.style.height = `${height}px`
    }

    render() {
        if (!this.isRunning) return

        const currentTime = performance.now()
        const deltaTime = (currentTime - this.lastTime) / 1000
        this.lastTime = currentTime

        // Update controller and card
        this.controller.update(deltaTime)
        this.card.update(deltaTime)

        const effectSettings = {
            hdrEnabled: this.hdrEnabled,
            saturationBoostEnabled: this.saturationBoostEnabled,
            showMask: this.showMask,
            maskActive: this.maskActive,
            isBaseShader: this.shaderManager.getActiveName() === 'base'
        }

        if (this.bloomPass.enabled) {
            // Bloom enabled: card → bloomPass → effectsPass → screen
            this.bloomPass.beginSceneRender()
            this.context.clear()
            this.renderer.render(this.card, this.controller, deltaTime, effectSettings)
            this.bloomPass.endSceneRender()
            this.bloomPass.renderBloom()  // Outputs to effectsPass.sceneFBO

            // Apply effects and render to screen
            this.effectsPass.render(
                this.effectsPass.getSceneTexture(),
                effectSettings
            )
        } else {
            // No bloom: card → effectsPass → screen
            this.effectsPass.beginSceneRender()
            this.context.clear()
            this.renderer.render(this.card, this.controller, deltaTime, effectSettings)
            this.effectsPass.endSceneRender()

            // Apply effects and render to screen
            this.effectsPass.render(
                this.effectsPass.getSceneTexture(),
                effectSettings
            )
        }

        requestAnimationFrame(() => this.render())
    }

    destroy() {
        this.isRunning = false
        this.controller?.destroy()
        this.shaderManager?.destroy()
        this.geometry?.destroy()
        this.bloomPass?.destroy()
        this.effectsPass?.destroy()
        this.textRenderer?.destroy()
    }
}

// Start the app
const app = new CardShaderApp()
app.init().catch(console.error)

// Expose app globally for testing
window.cardApp = app
