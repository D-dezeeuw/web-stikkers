import { WebGLContext } from './core/WebGLContext.js'
import { Geometry } from './core/Geometry.js'
import { createRainbowGradient, createNoiseTexture, createFoilPattern, createDepthMap } from './core/ProceduralTextures.js'
import { createFullMask } from './core/MaskFactory.js'
import { ShaderManager } from './shaders/ShaderManager.js'
import { Card } from './card/Card.js'
import { CardController } from './card/CardController.js'
import { CardRenderer } from './card/CardRenderer.js'
import { BloomPass } from './post/BloomPass.js'
import { EffectsPass } from './post/EffectsPass.js'
import { CardFactory } from './factories/CardFactory.js'
import { TextRenderer } from './factories/TextRenderer.js'

class MiniCardApp {
    constructor(canvas, shaderName = 'holographic', cardNumber = '001', cardType = 'zelda') {
        this.canvas = canvas
        this.shaderName = shaderName
        this.cardNumber = cardNumber
        this.cardType = cardType
        this.isRunning = false
        this.lastTime = 0
    }

    async init() {
        // Initialize WebGL
        this.context = new WebGLContext(this.canvas)
        this.gl = this.context.init()

        // Set canvas size
        const rect = this.canvas.getBoundingClientRect()
        const width = rect.width || 200
        const height = rect.height || 320
        this.canvas.width = width * (window.devicePixelRatio || 1)
        this.canvas.height = height * (window.devicePixelRatio || 1)
        this.context.resize()

        // Create geometry
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
        this.card.setTexture('effectMask', createFullMask(this.gl))

        // Load card texture
        this.cardFactory = new CardFactory(this.gl)
        const cards = await this.cardFactory.loadCardTextures()
        const cardData = cards[this.cardType]
        this.card.setTexture('base', cardData.texture)
        this.card.setTexture('effectMask', cardData.normalMap || cardData.brightnessMask)

        // Create text textures (required by shaders)
        this.textRenderer = new TextRenderer(this.gl)
        this.textRenderer.createTextTextures('Link', this.cardNumber, this.card)

        // Create controller and renderer
        this.controller = new CardController(this.card, this.canvas)
        this.renderer = new CardRenderer(this.gl, this.geometry, this.shaderManager)

        // Set up projection matrix (required for rendering!)
        this.renderer.updateProjection(this.canvas.width / this.canvas.height)

        // Create effects pass
        this.effectsPass = new EffectsPass(this.gl)
        await this.effectsPass.loadShader()
        this.effectsPass.resize(this.canvas.width, this.canvas.height)

        // Create bloom pass
        this.bloomPass = new BloomPass(this.gl)
        await this.bloomPass.loadShaders()
        this.bloomPass.resize(this.canvas.width, this.canvas.height)
        this.bloomPass.setOutputFBO(this.effectsPass.sceneFBO.fbo)
        this.bloomPass.enabled = true
        this.bloomPass.intensity = 1.2

        // Set shader
        this.shaderManager.use(this.shaderName)

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

    render() {
        if (!this.isRunning) return

        const currentTime = performance.now()
        const deltaTime = (currentTime - this.lastTime) / 1000
        this.lastTime = currentTime

        this.controller.update(deltaTime)
        this.card.update(deltaTime)

        const effectSettings = {
            hdrEnabled: false,
            saturationBoostEnabled: false,
            showMask: false,
            maskActive: true,
            isBaseShader: this.shaderName === 'base'
        }

        const gl = this.gl

        // Simple direct render (no bloom/effects) for testing
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.canvas.width, this.canvas.height)
        gl.clearColor(0.1, 0.1, 0.15, 1.0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.disable(gl.BLEND)

        this.renderer.render(this.card, this.controller, deltaTime, effectSettings)

        requestAnimationFrame(() => this.render())
    }
}

// Initialize 20 cards with different shaders
const shaders = [
    'holographic', 'foil', 'prizm', 'galaxy', 'cracked-ice',
    'refractor', 'starburst', 'etched', 'parallax', 'base'
]

async function initGrid() {
    // Wait for layout to settle
    await new Promise(r => setTimeout(r, 100))

    const apps = []

    // First 10: Zelda card with all shaders
    for (let i = 0; i < 10; i++) {
        const canvas = document.getElementById(`card-${i}`)
        const cardNumber = `${String(i + 1).padStart(3, '0')}/020`
        const app = new MiniCardApp(canvas, shaders[i], cardNumber, 'zelda')
        apps.push(app.init())
    }

    // Next 10: Demo thick card with all shaders
    for (let i = 0; i < 10; i++) {
        const canvas = document.getElementById(`card-${i + 10}`)
        const cardNumber = `${String(i + 11).padStart(3, '0')}/020`
        const app = new MiniCardApp(canvas, shaders[i], cardNumber, 'demo-thick')
        apps.push(app.init())
    }

    await Promise.all(apps)
    console.log('All 20 cards initialized')
}

initGrid().catch(console.error)
