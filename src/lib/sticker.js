/**
 * sticker - Core class for rendering shader cards
 *
 * Provides a clean options-based API that maps to internal WebGL components.
 * Supports lazy initialization for displaying many cards efficiently.
 */

import {
    createFullMask,
    createBorderMask,
    createCenterMask,
    createArtWindowMask,
    createRadialEdgeMask,
    createRadialCenterMask
} from '../core/MaskFactory.js'
import { Card } from '../card/Card.js'
import { CardController } from '../card/CardController.js'
import { CardRenderer } from '../card/CardRenderer.js'
import { RandomTextureFactory } from '../factories/RandomTextureFactory.js'
import { TextRenderer } from '../factories/TextRenderer.js'
import { TextureLoader } from './TextureLoader.js'
import { WebGLContextPool } from './WebGLContextPool.js'
import * as ShaderRegistry from './ShaderRegistry.js'
import { CONFIG } from '../config.js'
import { BloomPass } from '../post/BloomPass.js'

// Mask factory map
const MASK_FACTORIES = {
    'full': createFullMask,
    'border': createBorderMask,
    'center': createCenterMask,
    'art-window': createArtWindowMask,
    'radial-edge': createRadialEdgeMask,
    'radial-center': createRadialCenterMask
}

// Built-in card sources (procedural generators only)
const BUILTIN_SOURCES = ['random-emoji', 'random-geometric']

/**
 * Size presets for sticker rendering resolution
 * Maps size name to resolution scale factor
 * Base resolution is 400×640 (5:8 aspect ratio)
 */
const SIZE_PRESETS = {
    'xs': { scale: 0.25, width: 100, height: 160 },    // Tiny thumbnails
    's': { scale: 0.375, width: 150, height: 240 },    // Small cards
    'm': { scale: 0.5, width: 200, height: 320 },      // Medium cards (default)
    'l': { scale: 0.75, width: 300, height: 480 },     // Large cards
    'xl': { scale: 1.0, width: 400, height: 640 },     // Full quality
    'xxl': { scale: 'auto', width: null, height: null } // Auto: container size × DPR
}

// Default size preset
const DEFAULT_SIZE = 'm'

/**
 * Default options for sticker
 */
const DEFAULT_OPTIONS = {
    // Core
    shader: 'holographic',
    cardSrc: null,
    cardNormal: null,

    // Text overlays
    cardName: '',
    cardNumber: '',
    cardCollection: '',

    // Effects
    mask: 'full',
    bloom: 0.95,  // 0 = off, >0 = intensity (max 2.0)

    // Behavior
    interactive: true,
    lazy: false,
    autoplay: true,

    // Resolution - defaults to 'm' (200×320)
    size: DEFAULT_SIZE
}

export class sticker {
    /**
     * Create a new sticker instance
     * @param {HTMLCanvasElement} canvas - Canvas element to render to
     * @param {Object} options - Configuration options
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas  // Target canvas (2D) for displaying results
        this.options = { ...DEFAULT_OPTIONS, ...options }

        // Track if bloom was explicitly set by user (for auto-adjustment with brightness mask)
        this._bloomExplicitlySet = 'bloom' in options

        // State
        this.isActive = false
        this.isInitializing = false
        this.isRunning = false
        this.isReady = false
        this.lastTime = 0
        this.frameId = null

        // Callbacks (set by stickerElement to dispatch events)
        this.onError = null
        this.onSourceLoaded = null

        // Pool integration - borrowed context contains shared GL resources
        this._borrowedContext = null
        this._targetCtx = null  // 2D context for copying rendered frames

        // WebGL resources (from pool or card-specific)
        this.gl = null
        this.geometry = null       // From pool
        this.shaderManager = null  // From pool
        this.card = null           // Card-specific
        this.controller = null     // Card-specific
        this.renderer = null       // Card-specific
        this.textRenderer = null   // Card-specific
        this.textureLoader = null  // Card-specific
        this.cardFactory = null    // Card-specific
        this.randomFactory = null  // Card-specific
        this.bloomPass = null      // Card-specific bloom post-processing

        // Stored masks from card loading (for normal/brightness mask options)
        this.storedNormalMap = null
        this.storedBrightnessMask = null

        // Internal cache for generated content (random-emoji, random-geometric)
        // These persist across destroy/init cycles to maintain consistent visuals
        this._cachedBaseImageUrl = null
        this._cachedSourceType = null
        this._cachedMaskImageUrl = null
        this._isGeneratedContent = false
        this._generatedName = null
        this._generatedCollection = null

        // Static image for lazy mode
        this.staticImage = null
        this._snapshotBlobUrl = null  // Track blob URL for cleanup

        // Lazy mode target element (for listener cleanup)
        this._lazyTarget = null

        // Observers
        this.resizeObserver = null
        this.intersectionObserver = null

        // Event handlers bound to this instance
        this._boundActivate = () => this.activate()
        this._boundDeactivate = () => this.deactivate()
    }

    /**
     * Initialize WebGL and load resources using the context pool
     */
    async init() {
        if (this._borrowedContext) return // Already initialized
        if (this.isInitializing) return

        this.isInitializing = true

        try {
            // Determine render resolution based on size preset
            let renderWidth, renderHeight

            const sizeKey = (this.options.size || DEFAULT_SIZE).toLowerCase()
            const preset = SIZE_PRESETS[sizeKey]

            if (preset && preset.scale !== 'auto') {
                // Fixed preset resolution (ignores DPR for consistent performance)
                renderWidth = preset.width
                renderHeight = preset.height
            } else {
                // XXL / Auto mode: use container size with DPR
                const parent = this.canvas.parentElement
                const rect = parent?.getBoundingClientRect() || { width: 200, height: 320 }
                const width = rect.width || 200
                const height = rect.height || 320
                const dpr = window.devicePixelRatio || 1
                renderWidth = width * dpr
                renderHeight = height * dpr
            }

            // Set target canvas size (2D canvas for display)
            this.canvas.width = renderWidth
            this.canvas.height = renderHeight

            // Ensure canvas is in a valid state
            if (!this.canvas) {
                throw new Error('Canvas element is missing')
            }

            // Get 2D context for target canvas (we'll copy rendered frames here)
            if (!this._targetCtx) {
                this._targetCtx = this.canvas.getContext('2d')
            }

            // Borrow a WebGL context from the pool
            const pool = WebGLContextPool.getInstance()
            this._borrowedContext = await pool.borrow(this)

            // Use resources from the borrowed context
            this.gl = this._borrowedContext.gl
            this.geometry = this._borrowedContext.geometry
            this.shaderManager = this._borrowedContext.shaderManager

            // Resize the offscreen canvas to match target
            this._borrowedContext.resize(this.canvas.width, this.canvas.height)

            // Check if deactivated during async borrow
            if (!this.isActive && this.options.lazy) {
                this.cleanupPartialInit()
                return
            }

            // Create card (card-specific, not pooled)
            this.card = new Card({
                scaleX: 1,
                scaleY: 1,
                smoothing: 8
            })

            // Create texture loader (card-specific)
            this.textureLoader = new TextureLoader(this.gl)

            // Use procedural textures from pool
            const textures = this._borrowedContext.proceduralTextures
            this.card.setTexture('rainbow', textures.rainbow)
            this.card.setTexture('noise', textures.noise)
            this.card.setTexture('foil', textures.foil)
            this.card.setTexture('depth', textures.depth)

            // Load card texture (card-specific)
            // This stores normal/brightness textures but doesn't set effectMask
            await this.loadCardSource(this.options.cardSrc)

            // Apply effect mask AFTER card source loads
            // This ensures storedNormalMap/storedBrightnessMask are available
            // and respects the user's mask selection
            this.updateMask(this.options.mask)

            // Notify that source has loaded (for generated name etc)
            this.onSourceLoaded?.()

            // Check again after async load
            if (!this.isActive && this.options.lazy) {
                this.cleanupPartialInit()
                return
            }

            // Create text textures (card-specific)
            this.textRenderer = new TextRenderer(this.gl)
            this.updateTextTextures()

            // Create controller and renderer (card-specific)
            // Note: controller uses target canvas for mouse tracking
            if (this.options.interactive) {
                this.controller = new CardController(this.card, this.canvas)
            }
            this.renderer = new CardRenderer(this.gl, this.geometry, this.shaderManager)
            this.renderer.updateProjection(this.canvas.width / this.canvas.height)

            // Set active shader
            this.shaderManager.use(this.options.shader)

            // Setup resize observer
            this.setupResizeObserver()

            // Create bloom pass if enabled (after renderer, needs gl context)
            const bloomIntensity = Math.max(0, Math.min(2, this.options.bloom))
            if (bloomIntensity > 0) {
                this.bloomPass = new BloomPass(this.gl)
                await this.bloomPass.loadShaders()
                const offscreenCanvas = this._borrowedContext.canvas
                this.bloomPass.resize(offscreenCanvas.width, offscreenCanvas.height)
                this.bloomPass.setOutputFBO(null)  // Output to offscreen canvas
                this.bloomPass.enabled = true
                this.bloomPass.intensity = bloomIntensity
            }

            this.isReady = true
        } catch (err) {
            console.error('sticker init failed:', err)
            this.cleanupPartialInit()
            throw err
        } finally {
            this.isInitializing = false
        }
    }

    /**
     * Load card texture from source
     * @param {string|null} source - URL, built-in name, or null
     */
    async loadCardSource(source) {
        if (!source) {
            // No source - create empty card
            return
        }

        // Procedural generators
        if (source.startsWith('random-emoji') || source === 'random-geometric') {
            const sourceType = source.startsWith('random-emoji') ? 'random-emoji' : 'random-geometric'

            // Check if we have cached content OF THE SAME TYPE
            if (this._cachedBaseImageUrl && this._cachedSourceType === sourceType) {
                // Load from cache - same visual content as before
                await this._loadFromCache()
            } else {
                // Clear old cache if switching types
                this._cachedBaseImageUrl = null
                this._cachedSourceType = null

                // Parse optional emoji from source (format: "random-emoji:😀")
                let emoji = null
                if (source.startsWith('random-emoji:')) {
                    emoji = source.substring('random-emoji:'.length)
                }
                // Generate new random content and cache it
                await this._generateAndCacheRandomContent(sourceType, emoji)
                this._cachedSourceType = sourceType
            }

            // Default to radial-edge mask for random cards (better visual fit)
            // Only override the default mask - respect explicit user choices
            if (this.options.mask === 'full') {
                this.options.mask = 'radial-edge'
            }
            return
        }

        // URL-based loading - not generated content
        this._isGeneratedContent = false

        const texture = await this.textureLoader.load(source)
        this.card.setTexture('base', texture)

        // Load normal map if provided, otherwise generate brightness mask
        // Note: We only STORE these textures here - the actual effectMask is set
        // by updateMask() after loadCardSource() completes, respecting user's mask selection
        if (this.options.cardNormal) {
            const normalMap = await this.textureLoader.load(this.options.cardNormal)
            this.storedNormalMap = normalMap
            this.storedBrightnessMask = null
        } else {
            const brightnessMask = await this._createBrightnessMaskFromUrl(source)
            this.storedNormalMap = null
            this.storedBrightnessMask = brightnessMask
        }

        // Update text overlays (collection name is overlay-based for URL content)
        this.updateTextTextures()
    }

    /**
     * Create brightness mask from image URL
     * @param {string} url - Image URL
     * @returns {Promise<Texture>}
     */
    async _createBrightnessMaskFromUrl(url) {
        const img = await this._loadImage(url)
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        const { createTextureBrightnessMask } = await import('../core/MaskFactory.js')
        return createTextureBrightnessMask(this.gl, canvas)
    }

    /**
     * Load an image from URL
     * @param {string} url - Image URL
     * @returns {Promise<HTMLImageElement>}
     */
    _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = url
        })
    }

    /**
     * Generate random content and cache it for later reuse
     * @param {string} source - 'random-emoji' or 'random-geometric'
     * @param {string|null} emoji - Optional specific emoji to use
     */
    async _generateAndCacheRandomContent(source, emoji = null) {
        const type = source === 'random-emoji' ? 'emoji' : 'geometric'
        const defaultCollection = type === 'emoji' ? 'EMOJI' : 'GEOMETRY'
        const collectionName = this.options.cardCollection || defaultCollection

        this.randomFactory = new RandomTextureFactory(this.gl)
        const cardData = this.randomFactory.createRandomCard({ type, emoji, collectionName })

        this.card.setTexture('base', cardData.texture)
        // Store brightness mask - actual effectMask is set by updateMask() after loadCardSource()
        this.storedNormalMap = null
        this.storedBrightnessMask = cardData.brightnessMask

        // Cache the generated content for reuse
        this._isGeneratedContent = true
        this._cachedBaseImageUrl = cardData.canvas.toDataURL('image/png')
        this._generatedName = cardData.generatedName || ''
        this._generatedCollection = defaultCollection

        // Clear the collection overlay texture (collection name is baked into base)
        this.updateTextTextures()

        // Auto-set card name if not already set
        if (this._generatedName && !this.options.cardName) {
            this.setCardName(this._generatedName)
        }
    }

    /**
     * Load content from internal cache
     */
    async _loadFromCache() {
        // Load base texture from cached data URL
        const texture = await this.textureLoader.load(this._cachedBaseImageUrl)
        this.card.setTexture('base', texture)

        // Recreate brightness mask from the cached image
        const brightnessMask = await this._createBrightnessMaskFromUrl(this._cachedBaseImageUrl)
        this.storedNormalMap = null
        this.storedBrightnessMask = brightnessMask
        this.card.setTexture('effectMask', brightnessMask)
    }

    /**
     * Copy cached content from another sticker instance (internal use)
     * Used for cross-element content transfer (e.g., grid card → overlay)
     * @param {sticker} source - Source sticker to copy from
     */
    _copyContentFrom(source) {
        if (source && source._cachedBaseImageUrl) {
            this._cachedBaseImageUrl = source._cachedBaseImageUrl
            this._cachedSourceType = source._cachedSourceType
            this._isGeneratedContent = source._isGeneratedContent
            this._generatedName = source._generatedName
            this._generatedCollection = source._generatedCollection
        }
    }

    /**
     * Check if this instance has cached generated content
     */
    get _hasGeneratedContent() {
        return this._isGeneratedContent && this._cachedBaseImageUrl !== null
    }

    /**
     * Get the generated name (for random-emoji or random-geometric content)
     */
    get generatedName() {
        return this._generatedName
    }

    /**
     * Get the generated collection name (for random-emoji or random-geometric content)
     */
    get generatedCollection() {
        return this._generatedCollection
    }

    /**
     * Update the effect mask
     * @param {string} maskName - Mask type name
     */
    updateMask(maskName) {
        // Handle special masks that use stored textures
        if (maskName === 'normal' && this.storedNormalMap) {
            this.card.setTexture('effectMask', this.storedNormalMap)
            return
        }
        if (maskName === 'brightness' && this.storedBrightnessMask) {
            this.card.setTexture('effectMask', this.storedBrightnessMask)
            return
        }

        // Handle procedural masks
        const factory = MASK_FACTORIES[maskName]
        if (factory) {
            this.card.setTexture('effectMask', factory(this.gl))
            return
        }

        // Fallback: requested mask unavailable (e.g., 'normal' without a normal map)
        // Use brightness mask if available, otherwise default to 'full'
        if (this.storedBrightnessMask) {
            this.card.setTexture('effectMask', this.storedBrightnessMask)
        } else {
            this.card.setTexture('effectMask', MASK_FACTORIES['full'](this.gl))
        }
    }

    /**
     * Update text textures
     * For generated content (random-emoji, random-geometric), the collection name
     * is baked into the base texture, so we pass empty string for collection
     * to avoid double-rendering.
     */
    updateTextTextures() {
        if (!this.textRenderer || !this.card) return

        // For generated content, collection name is baked into base texture
        // Pass empty string to create a blank collection overlay
        const collectionForOverlay = this._isGeneratedContent ? '' : (this.options.cardCollection || '')

        this.textRenderer.createTextTextures(
            this.options.cardName || '',
            this.options.cardNumber || '',
            collectionForOverlay,
            this.card
        )
    }

    /**
     * Setup resize observer
     */
    setupResizeObserver() {
        if (this.resizeObserver) return

        this.resizeObserver = new ResizeObserver(entries => {
            if (!this.gl || !this.renderer) return

            const { width, height } = entries[0].contentRect
            if (width === 0 || height === 0) return

            const sizeKey = (this.options.size || DEFAULT_SIZE).toLowerCase()
            const preset = SIZE_PRESETS[sizeKey]

            // For fixed presets (not xxl/auto), only update aspect ratio
            if (preset && preset.scale !== 'auto') {
                this.renderer.updateProjection(width / height)
                return
            }

            // XXL/Auto mode: resize canvas with DPR
            const dpr = window.devicePixelRatio || 1
            this.canvas.width = width * dpr
            this.canvas.height = height * dpr

            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
            this.renderer.updateProjection(width / height)

            // Resize bloom pass if it exists
            if (this.bloomPass) {
                this.bloomPass.resize(this.canvas.width, this.canvas.height)
            }
        })

        const parent = this.canvas.parentElement
        if (parent) {
            this.resizeObserver.observe(parent)
        }
    }

    /**
     * Setup lazy mode with hover activation
     * @param {HTMLElement} hoverTarget - Element to listen for hover events
     */
    setupLazyMode(hoverTarget) {
        if (!this.options.lazy) return

        // Create static image overlay
        this.staticImage = document.createElement('img')
        this.staticImage.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: none;'
        this.canvas.parentElement?.appendChild(this.staticImage)

        // Add hover listeners (store target for cleanup in destroy)
        this._lazyTarget = hoverTarget || this.canvas.parentElement || this.canvas
        this._lazyTarget.addEventListener('mouseenter', this._boundActivate)
        this._lazyTarget.addEventListener('mouseleave', this._boundDeactivate)
    }

    /**
     * Render a static frame and capture as image (one-time capture)
     */
    async renderStaticFrame() {
        // Temporarily set active for initialization
        this.isActive = true

        try {
            await this.init()

            // Single frame render - textures are ready after init()
            this._isStaticRender = true
            this.renderFrame(0.016)
            this._isStaticRender = false

            // Capture snapshot (only capture point - not re-captured on deactivate)
            await this.captureSnapshot()
        } finally {
            // Cleanup
            this.isActive = false
            this.destroy()
        }
    }

    /**
     * Capture current canvas to static image (async for performance)
     * Crops to card bounds and uses JPEG for faster encoding (no transparency needed)
     */
    async captureSnapshot() {
        if (!this.staticImage) return

        // Revoke previous blob URL to prevent memory leak
        if (this._snapshotBlobUrl) {
            URL.revokeObjectURL(this._snapshotBlobUrl)
            this._snapshotBlobUrl = null
        }

        try {
            // Calculate card bounds in pixel coordinates
            // Card fills 85% of canvas height, centered, with 5:8 aspect ratio
            const fillPercent = CONFIG.card.viewportFillPercent
            const cardAspect = CONFIG.card.aspectRatio  // 5/8 = 0.625

            const cardPixelHeight = Math.round(this.canvas.height * fillPercent)
            const cardPixelWidth = Math.round(cardPixelHeight * cardAspect)

            // Card is centered in canvas
            const cardLeft = Math.round((this.canvas.width - cardPixelWidth) / 2)
            const cardTop = Math.round((this.canvas.height - cardPixelHeight) / 2)

            // Create a temporary canvas for the cropped card
            const cropCanvas = document.createElement('canvas')
            cropCanvas.width = cardPixelWidth
            cropCanvas.height = cardPixelHeight
            const cropCtx = cropCanvas.getContext('2d')

            // Copy just the card region from the main canvas
            cropCtx.drawImage(
                this.canvas,
                cardLeft, cardTop, cardPixelWidth, cardPixelHeight,  // source rect
                0, 0, cardPixelWidth, cardPixelHeight                 // dest rect
            )

            // Encode as JPEG (faster than PNG, smaller size, no transparency needed)
            const blob = await this._canvasToBlob(cropCanvas, 'image/jpeg', 0.92)
            this._snapshotBlobUrl = URL.createObjectURL(blob)
            this.staticImage.src = this._snapshotBlobUrl
            this.staticImage.style.display = 'block'
            this.canvas.style.display = 'none'

            // Adjust static image positioning to account for cropping
            // The image needs to be positioned where the card was in the original canvas
            const leftPercent = (cardLeft / this.canvas.width) * 100
            const topPercent = (cardTop / this.canvas.height) * 100
            const widthPercent = (cardPixelWidth / this.canvas.width) * 100
            const heightPercent = (cardPixelHeight / this.canvas.height) * 100

            this.staticImage.style.left = `${leftPercent}%`
            this.staticImage.style.top = `${topPercent}%`
            this.staticImage.style.width = `${widthPercent}%`
            this.staticImage.style.height = `${heightPercent}%`
        } catch (err) {
            // Fallback to full canvas PNG if cropping fails
            console.warn('Cropped JPEG capture failed, falling back to full PNG:', err.message)
            const blob = await this._canvasToBlob(this.canvas, 'image/png').catch(() => null)
            if (blob) {
                this._snapshotBlobUrl = URL.createObjectURL(blob)
                this.staticImage.src = this._snapshotBlobUrl
            } else {
                this.staticImage.src = this.canvas.toDataURL('image/png')
            }
            // Reset positioning for full canvas fallback
            this.staticImage.style.left = '0'
            this.staticImage.style.top = '0'
            this.staticImage.style.width = '100%'
            this.staticImage.style.height = '100%'
            this.staticImage.style.display = 'block'
            this.canvas.style.display = 'none'
        }
    }

    /**
     * Promise wrapper for canvas.toBlob()
     * @param {HTMLCanvasElement} canvas
     * @param {string} type - MIME type (image/jpeg, image/png, image/webp)
     * @param {number} quality - Quality for lossy formats (0-1)
     * @returns {Promise<Blob>}
     */
    _canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob)
                    } else {
                        reject(new Error('toBlob returned null'))
                    }
                },
                type,
                quality
            )
        })
    }

    /**
     * Show canvas, hide static image
     */
    showCanvas() {
        if (this.staticImage) {
            this.staticImage.style.display = 'none'
        }
        this.canvas.style.display = 'block'
    }

    /**
     * Activate the card (for lazy mode)
     */
    async activate() {
        if (this.isActive || this.isInitializing) return
        this.isActive = true

        try {
            await this.init()

            if (!this.isActive) return // Deactivated during init

            this.showCanvas()
            this.start()
        } catch (err) {
            console.error('Failed to activate sticker:', err)
            this.isActive = false
        }
    }

    /**
     * Deactivate the card (for lazy mode)
     */
    deactivate() {
        if (!this.isActive) return
        this.isActive = false

        if (this.isInitializing) return // Will bail out in init

        // Just restore static image visibility and release resources
        // No re-capture - initial static frame is sufficient
        this.restoreStaticImage()
        if (this.gl) {
            this.destroy()
        }
    }

    /**
     * Restore static image visibility (without capturing)
     */
    restoreStaticImage() {
        if (this.staticImage) {
            this.staticImage.style.display = 'block'
        }
        this.canvas.style.display = 'none'
    }

    /**
     * Start the render loop
     */
    start() {
        if (this.isRunning) return
        this.isRunning = true
        this.lastTime = performance.now()
        this.renderLoop()
    }

    /**
     * Stop the render loop
     */
    stop() {
        this.isRunning = false
        if (this.frameId) {
            cancelAnimationFrame(this.frameId)
            this.frameId = null
        }
    }

    /**
     * Render a single frame
     * @param {number} deltaTime - Time since last frame in seconds
     * @param {boolean} copyToTarget - Whether to copy to target canvas (default: true)
     */
    renderFrame(deltaTime, copyToTarget = true) {
        if (!this.gl || !this.card || !this.renderer || !this._borrowedContext) return

        this.card.update(deltaTime)
        this.controller?.update(deltaTime)

        // Reduce effect intensity for certain masks on intense shaders
        const isReducedMask = this.options.mask === 'brightness' || this.options.mask === 'radial-edge'
        const isIntenseShader = this.options.shader === 'holographic' || this.options.shader === 'starburst'
        const effectScale = (isReducedMask && isIntenseShader) ? 0.5 : 1.0

        const effectSettings = {
            maskActive: this.options.mask !== 'full',
            isBaseShader: this.options.shader === 'base',
            textOpacity: this._isStaticRender ? 1.0 : 0.2,
            effectScale
        }

        const gl = this.gl
        const offscreenCanvas = this._borrowedContext.canvas

        if (this.bloomPass?.enabled) {
            // Bloom pipeline: render to bloom FBO → process → output to offscreen canvas
            this.bloomPass.beginSceneRender()
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
            gl.disable(gl.BLEND)

            this.renderer.render(this.card, this.controller, deltaTime, effectSettings)

            this.bloomPass.endSceneRender()
            this.bloomPass.renderBloom()  // Outputs to offscreen canvas (FBO=null)

            // Invalidate texture cache - bloom composite binds sceneFBO.texture to slot 0,
            // which would cause a feedback loop on the next frame if CardRenderer skips rebinding
            this.renderer.invalidateTextureCache()
        } else {
            // Direct render to offscreen canvas (no bloom)
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            gl.viewport(0, 0, offscreenCanvas.width, offscreenCanvas.height)
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
            gl.disable(gl.BLEND)

            this.renderer.render(this.card, this.controller, deltaTime, effectSettings)
        }

        // Copy to target canvas if requested
        if (copyToTarget) {
            this.renderToTarget()
        }
    }

    /**
     * Copy rendered frame from offscreen canvas to target (visible) canvas
     */
    renderToTarget() {
        if (!this._borrowedContext || !this._targetCtx) return

        const offscreenCanvas = this._borrowedContext.canvas
        // Clear target canvas for proper transparency
        this._targetCtx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        this._targetCtx.drawImage(offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height)
    }

    /**
     * Main render loop
     */
    renderLoop() {
        if (!this.isRunning || !this.gl) return

        const currentTime = performance.now()
        const deltaTime = (currentTime - this.lastTime) / 1000
        this.lastTime = currentTime

        this.renderFrame(deltaTime)

        this.frameId = requestAnimationFrame(() => this.renderLoop())
    }

    /**
     * Clean up partial initialization
     */
    cleanupPartialInit() {
        // Destroy card-specific resources only (not pooled resources)
        this.textRenderer?.destroy()
        this.controller?.destroy()

        // Return context to pool (don't destroy pooled resources)
        if (this._borrowedContext) {
            this._borrowedContext.release()
            this._borrowedContext = null
        }

        // Clear references (pooled resources are not destroyed)
        this.gl = null
        this.geometry = null
        this.shaderManager = null
        this.card = null
        this.controller = null
        this.renderer = null
        this.cardFactory = null
        this.randomFactory = null
        this.textRenderer = null
        this.textureLoader = null
        this.isReady = false
    }

    /**
     * Full cleanup and destroy
     */
    destroy() {
        this.stop()

        // Revoke snapshot blob URL to prevent memory leak
        if (this._snapshotBlobUrl) {
            URL.revokeObjectURL(this._snapshotBlobUrl)
            this._snapshotBlobUrl = null
        }

        // Remove lazy mode event listeners - CRITICAL to prevent context leaks
        if (this._lazyTarget) {
            this._lazyTarget.removeEventListener('mouseenter', this._boundActivate)
            this._lazyTarget.removeEventListener('mouseleave', this._boundDeactivate)
            this._lazyTarget = null
        }

        // Disconnect observers
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
        this.intersectionObserver?.disconnect()
        this.intersectionObserver = null

        // Clean up card-specific WebGL resources only (not pooled resources)
        this.controller?.destroy()
        this.textRenderer?.destroy()
        this.bloomPass?.destroy()
        this.bloomPass = null
        // Note: geometry and shaderManager are pooled, don't destroy them

        // Return context to pool
        if (this._borrowedContext) {
            this._borrowedContext.release()
            this._borrowedContext = null
        }

        // Clear references (pooled resources go back to pool, not destroyed)
        this.gl = null
        this.geometry = null
        this.shaderManager = null
        this.card = null
        this.controller = null
        this.renderer = null
        this.cardFactory = null
        this.randomFactory = null
        this.textRenderer = null
        this.textureLoader = null
        this.isReady = false

        // Note: No need to replace canvas - we use 2D context now
        // The target canvas can be reused since it's not a WebGL canvas
    }

    // ==================== Setters ====================

    /**
     * Set the active shader
     * @param {string} name - Shader name
     */
    setShader(name) {
        if (this.options.shader === name) return  // Skip if unchanged
        this.options.shader = name
        if (this.shaderManager) {
            this.shaderManager.use(name)
        }
    }

    /**
     * Set the card source
     * @param {string} source - URL or built-in name
     */
    async setCardSrc(source) {
        if (this.options.cardSrc === source) return  // Skip if unchanged
        this.options.cardSrc = source
        if (this.gl && this.card) {
            try {
                await this.loadCardSource(source)
                // Re-apply mask after source loads to use new texture data
                this.updateMask(this.options.mask)
                this.onSourceLoaded?.()
            } catch (err) {
                console.error('Failed to load card source:', err)
                this.onError?.(err)
            }
        }
    }

    /**
     * Set the normal map source
     * @param {string} source - URL to normal map image
     */
    async setCardNormal(source) {
        if (this.options.cardNormal === source) return  // Skip if unchanged
        this.options.cardNormal = source

        // Reload card source when normal map changes (added or removed)
        // Skip for random/procedural sources which don't use normal maps
        const isRandomSource = this.options.cardSrc?.startsWith('random-')
        if (this.gl && this.card && this.options.cardSrc && !isRandomSource) {
            try {
                await this.loadCardSource(this.options.cardSrc)
            } catch (err) {
                console.error('Failed to reload card source:', err)
                this.onError?.(err)
            }
        }
    }

    /**
     * Set the card name
     * @param {string} name - Card name text
     */
    setCardName(name) {
        if (this.options.cardName === name) return  // Skip if unchanged
        this.options.cardName = name
        this.updateTextTextures()
    }

    /**
     * Set the card number
     * @param {string} number - Card number text
     */
    setCardNumber(number) {
        if (this.options.cardNumber === number) return  // Skip if unchanged
        this.options.cardNumber = number
        this.updateTextTextures()
    }

    /**
     * Set the card collection name
     * @param {string} collection - Collection name text
     */
    setCardCollection(collection) {
        if (this.options.cardCollection === collection) return  // Skip if unchanged
        this.options.cardCollection = collection
        // Collection name is baked into the texture for generated content
        if (this._isGeneratedContent && this.gl && this.card) {
            // Skip regeneration if setting to the already-generated collection name
            // This prevents double-generation when syncing attributes after random generation
            if (collection === this._generatedCollection) {
                return
            }
            // Clear cache to force regeneration with new collection name
            this._cachedBaseImageUrl = null
            this.loadCardSource(this.options.cardSrc)
        } else {
            // For custom URL cards, update the text texture overlay
            this.updateTextTextures()
        }
    }

    /**
     * Set the effect mask
     * @param {string} mask - Mask name
     */
    setMask(mask) {
        if (this.options.mask === mask) return  // Skip if unchanged
        this.options.mask = mask
        if (this.gl && this.card) {
            this.updateMask(mask)
        }
        // Auto-adjust bloom for brightness mask (if not explicitly set by user)
        this._autoAdjustBloomForMask(mask)
    }

    /**
     * Auto-adjust bloom intensity based on mask type
     * Certain masks cause excessive bloom, so we reduce it automatically
     * unless the user has explicitly set a bloom value
     */
    _autoAdjustBloomForMask(mask) {
        if (this._bloomExplicitlySet) return  // User set bloom explicitly, don't override

        const isReducedMask = mask === 'brightness' || mask === 'radial-edge'
        const targetBloom = isReducedMask ? 0.2 : 0.95  // Lower for reduced masks, normal default otherwise

        if (this.options.bloom !== targetBloom) {
            this.options.bloom = targetBloom
            if (this.bloomPass) {
                this.bloomPass.enabled = targetBloom > 0
                this.bloomPass.intensity = targetBloom
            }
        }
    }

    /**
     * Set bloom intensity
     * @param {number} intensity - 0 = off, >0 = bloom strength (default 0.95, max 2.0)
     */
    setBloom(intensity) {
        const value = Math.max(0, Math.min(2, intensity))
        if (this.options.bloom === value) return
        this.options.bloom = value
        this._bloomExplicitlySet = true  // User explicitly set bloom, don't auto-adjust
        if (this.bloomPass) {
            this.bloomPass.enabled = value > 0
            this.bloomPass.intensity = value
        }
    }

    /**
     * Set multiple options at once
     * @param {Object} options - Options to update
     */
    setOptions(options) {
        for (const [key, value] of Object.entries(options)) {
            switch (key) {
                case 'shader':
                    this.setShader(value)
                    break
                case 'cardSrc':
                    this.setCardSrc(value)
                    break
                case 'cardNormal':
                    this.setCardNormal(value)
                    break
                case 'cardName':
                    this.setCardName(value)
                    break
                case 'cardNumber':
                    this.setCardNumber(value)
                    break
                case 'cardCollection':
                    this.setCardCollection(value)
                    break
                case 'mask':
                    this.setMask(value)
                    break
                case 'bloom':
                    this.setBloom(value)
                    break
                case 'interactive':
                case 'lazy':
                case 'autoplay':
                    this.options[key] = value
                    break
                case 'size':
                    this.setSize(value)
                    break
            }
        }
    }

    /**
     * Set the render size preset
     * @param {string} size - Size preset ('xs'|'s'|'m'|'l'|'xl'|'xxl')
     */
    setSize(size) {
        const normalizedSize = (size || DEFAULT_SIZE).toLowerCase()
        if (this.options.size === normalizedSize) return  // Skip if unchanged

        // Validate size preset
        if (!SIZE_PRESETS[normalizedSize]) {
            console.warn(`sticker: Unknown size preset '${size}'. Valid sizes: xs, s, m, l, xl, xxl`)
            return
        }

        this.options.size = normalizedSize
        // Note: Size changes take effect on next init (resize during render not supported)
    }

    // ==================== Static ====================

    /**
     * Get list of available shader names
     */
    static get shaderNames() {
        return ShaderRegistry.SHADER_NAMES
    }

    /**
     * Get list of available mask names
     */
    static get maskNames() {
        return [...Object.keys(MASK_FACTORIES), 'normal', 'brightness']
    }

    /**
     * Get list of built-in card sources
     */
    static get builtinSources() {
        return BUILTIN_SOURCES
    }

    /**
     * Get available size presets
     */
    static get sizePresets() {
        return { ...SIZE_PRESETS }
    }

    /**
     * Get list of valid size names
     */
    static get sizeNames() {
        return Object.keys(SIZE_PRESETS)
    }

    /**
     * Get pool statistics (for debugging)
     */
    static get poolStats() {
        return WebGLContextPool.getInstance().getStats()
    }

    /**
     * Get current number of active WebGL contexts (for debugging)
     */
    static get activeContextCount() {
        const stats = WebGLContextPool.getInstance().getStats()
        return stats.inUse
    }
}
