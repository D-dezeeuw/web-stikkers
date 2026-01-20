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
import { UIController } from './ui/UIController.js'
import { TextRenderer } from './factories/TextRenderer.js'
import { RandomTextureFactory } from './factories/RandomTextureFactory.js'
import { Texture } from './core/Texture.js'
import { createTextureBrightnessMask } from './core/MaskFactory.js'

class CardShaderApp {
    constructor() {
        this.canvas = document.getElementById('card-canvas')

        // Effect settings
        this.maskActive = true
        this.maskType = 'normal-map'  // Track current mask type for effect scaling
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
        this.uiController = null
        this.textRenderer = null
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

        // Load zelda card textures directly
        const zeldaVisual = new Texture(this.gl)
        await zeldaVisual.load('src/textures/zelda/visual.png')
        const zeldaNormal = new Texture(this.gl)
        await zeldaNormal.load('src/textures/zelda/normal.png')
        const zeldaBrightness = await this._createBrightnessMaskFromImage('src/textures/zelda/visual.png')
        this.cards['zelda'] = {
            texture: zeldaVisual,
            normalMap: zeldaNormal,
            brightnessMask: zeldaBrightness
        }

        // Create random texture cards
        this.randomFactory = new RandomTextureFactory(this.gl)
        const emojiCard = this.randomFactory.createRandomCard({ type: 'emoji' })
        this.cards['random-emoji'] = {
            texture: emojiCard.texture,
            normalMap: null,
            brightnessMask: emojiCard.brightnessMask
        }
        const geometricCard = this.randomFactory.createRandomCard({ type: 'geometric' })
        this.cards['random-geometric'] = {
            texture: geometricCard.texture,
            normalMap: null,
            brightnessMask: geometricCard.brightnessMask
        }

        // Initialize text renderer
        this.textRenderer = new TextRenderer(this.gl)
        this.cardText = document.getElementById('card-text').value || 'Link'
        this.cardNumber = document.getElementById('card-number').value || '69/321'
        this.textRenderer.createTextTextures(this.cardText, this.cardNumber, '', this.card)

        // Create controller and renderer
        this.controller = new CardController(this.card, this.canvas)
        this.renderer = new CardRenderer(this.gl, this.geometry, this.shaderManager)

        // Create bloom pass
        this.bloomPass = new BloomPass(this.gl)
        await this.bloomPass.loadShaders()
        this.bloomPass.resize(this.canvas.width, this.canvas.height)
        // Bloom outputs directly to screen (null = default framebuffer)
        this.bloomPass.setOutputFBO(null)
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

        // Reduce effect intensity for certain masks on intense shaders
        const isReducedMask = this.maskType === 'texture-brightness' || this.maskType === 'radial-edge'
        const shaderName = this.shaderManager.getActiveName()
        const isIntenseShader = shaderName === 'holographic' || shaderName === 'starburst'
        const effectScale = (isReducedMask && isIntenseShader) ? 0.5 : 1.0

        const effectSettings = {
            maskActive: this.maskActive,
            isBaseShader: shaderName === 'base',
            effectScale
        }

        // Reduce bloom intensity when no mask is active (full card effect)
        this.bloomPass.intensity = this.maskActive ? 0.95 : 0.2;

        if (this.bloomPass.enabled) {
            // Bloom enabled: card → bloomPass → screen
            this.bloomPass.beginSceneRender()
            this.context.clear()
            this.renderer.render(this.card, this.controller, deltaTime, effectSettings)
            this.bloomPass.endSceneRender()
            this.bloomPass.renderBloom()  // Outputs directly to screen
        } else {
            // No bloom: card → screen (direct render)
            this.context.clear()
            this.renderer.render(this.card, this.controller, deltaTime, effectSettings)
        }

        requestAnimationFrame(() => this.render())
    }

    destroy() {
        this.isRunning = false
        this.controller?.destroy()
        this.shaderManager?.destroy()
        this.geometry?.destroy()
        this.bloomPass?.destroy()
        this.textRenderer?.destroy()
    }

    /**
     * Create brightness mask from image URL
     * @param {string} url - Image URL
     * @returns {Promise<Texture>}
     */
    _createBrightnessMaskFromImage(url) {
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
}

// Start the app
const app = new CardShaderApp()
app.init().catch(console.error)

// Expose app globally for testing
window.cardApp = app
