/**
 * ShaderButton - Core class for rendering shader effects on buttons
 *
 * Uses the shared ButtonResourceCache for pooled resources (geometry, shaders, masks)
 * and borrows WebGL contexts from WebGLContextPool.
 */

import { Texture } from '../core/Texture.js'
import { WebGLContextPool } from './WebGLContextPool.js'
import { ButtonResourceCache, TEXTURE_SLOTS } from './ButtonResourceCache.js'
import * as ShaderRegistry from './ShaderRegistry.js'
import { CONFIG } from '../config.js'

/**
 * Default options for ShaderButton
 */
const DEFAULT_OPTIONS = {
    shader: 'holographic',
    mode: 'background',      // 'background' or 'border'
    variant: null,
    borderWidth: 0.06,       // Border thickness (0-0.5)
    intensity: 0.5,          // Effect intensity multiplier
    restingTilt: [0.2, 0.5], // Resting tilt angle [x, y] for static appearance
    restingFocus: [0.5, 0.5]   // Resting focus point [x, y] - where light centers at rest
                               // x: -1 (left) to +1 (right), y: -1 (top) to +1 (bottom)
                               
}

export class ShaderButton {
    /**
     * Create a new ShaderButton instance
     * @param {HTMLCanvasElement} canvas - Canvas element to render to
     * @param {Object} options - Configuration options
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas
        this.options = { ...DEFAULT_OPTIONS, ...options }

        // State
        this.isInitialized = false
        this.isRunning = false
        this.isHovering = false
        this.isAnimating = false  // Continuous animation (for CTA buttons)
        this.lastTime = 0
        this.frameId = null
        this.time = 0

        // Context management
        this._initialRenderFrames = 0
        this._releaseTimeout = null
        this._hasStaticRender = false
        this._borrowPending = false  // Guard against concurrent borrow attempts

        // Mouse position (normalized -1 to 1)
        this.mouseX = 0
        this.mouseY = 0
        this.targetMouseX = 0
        this.targetMouseY = 0

        // Hover transition (0 = resting, 1 = fully hovering)
        this.hoverAmount = 0

        // Pool integration
        this._borrowedContext = null
        this._targetCtx = null
        this._lastContextId = null

        // WebGL resources (references to cached resources)
        this.gl = null
        this._resources = null  // ButtonResourceCache.ContextResources
        this.activeShader = null
        this.activeShaderName = null

        // Per-button texture (solid color base)
        this.baseColorTexture = null

        // Callbacks
        this.onError = null
    }

    /**
     * Initialize WebGL and prepare for rendering
     */
    async initialize() {
        if (this.isInitialized) return
        if (this._borrowedContext) return

        try {
            // Get target canvas 2D context
            if (!this._targetCtx) {
                this._targetCtx = this.canvas.getContext('2d')
            }

            // Borrow a WebGL context from the pool
            const pool = WebGLContextPool.getInstance()
            this._borrowedContext = await pool.borrow(this)
            this._lastContextId = this._borrowedContext.contextId
            this.gl = this._borrowedContext.gl

            // Set canvas size
            const rootNode = this.canvas.getRootNode()
            const hostElement = rootNode.host || this.canvas.parentElement || this.canvas
            const rect = hostElement.getBoundingClientRect()
            const dpr = window.devicePixelRatio || 1

            const width = rect.width > 0 ? rect.width : 140
            const height = rect.height > 0 ? rect.height : 48

            this.canvas.width = width * dpr
            this.canvas.height = height * dpr

            // Resize offscreen canvas
            this._borrowedContext.resize(this.canvas.width, this.canvas.height)

            // Get cached resources for this GL context
            this._resources = ButtonResourceCache.getInstance().getResources(this.gl)

            // Create per-button base texture
            this._createBaseTexture()

            // Set active shader
            this.setShader(this.options.shader)

            this.isInitialized = true

            // Do initial render, then release context
            this._doInitialRender()
        } catch (err) {
            console.error('ShaderButton init failed:', err)
            this.onError?.(err)
            this._cleanup()
            throw err
        }
    }

    /**
     * Create a gradient base texture for shader effects
     */
    _createBaseTexture() {
        const gl = this.gl
        const size = 128

        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        const gradient = ctx.createLinearGradient(0, 0, size, size)
        gradient.addColorStop(0, '#4a4a8e')
        gradient.addColorStop(0.5, '#6a6aae')
        gradient.addColorStop(1, '#4a4a8e')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, size, size)

        this.baseColorTexture = new Texture(gl)
        this.baseColorTexture.createFromImage(canvas)
    }

    /**
     * Do initial render frames, then release context (unless animating)
     */
    _doInitialRender() {
        this._initialRenderFrames = 0
        const maxFrames = 30

        const doFrame = () => {
            if (this._initialRenderFrames >= maxFrames || this.isHovering || this.isAnimating) {
                if (this.isHovering || this.isAnimating) {
                    // Keep running - either hovering or continuous animation
                    this.start()
                } else {
                    this._hasStaticRender = true
                    this._releaseContext()
                }
                return
            }

            this._initialRenderFrames++
            this.render(1/60)
            requestAnimationFrame(doFrame)
        }

        requestAnimationFrame(doFrame)
    }

    /**
     * Release context back to pool
     * Note: We DON'T destroy baseColorTexture here - it stays valid if we
     * get the same context back. It's only destroyed on full destroy() or
     * when we get a different context.
     */
    _releaseContext() {
        if (this._borrowedContext) {
            this._borrowedContext.release()
            this._borrowedContext = null
            this.gl = null
            this._resources = null
            this.activeShader = null  // Clear shader reference (will refresh on borrow)
        }
    }

    /**
     * Borrow context from pool for active rendering
     */
    async _borrowContext() {
        if (this._borrowedContext) return true
        if (this._borrowPending) return false  // Already borrowing, don't queue another

        this._borrowPending = true
        try {
            const pool = WebGLContextPool.getInstance()
            const oldContextId = this._lastContextId
            this._borrowedContext = await pool.borrow(this)
            this.gl = this._borrowedContext.gl

            // Resize to match canvas
            const dpr = window.devicePixelRatio || 1
            const rect = this.canvas.getBoundingClientRect()
            const width = rect.width > 0 ? rect.width * dpr : this.canvas.width
            const height = rect.height > 0 ? rect.height * dpr : this.canvas.height
            this._borrowedContext.resize(width, height)

            // Get resources for this context
            this._resources = ButtonResourceCache.getInstance().getResources(this.gl)

            // Check if we got a different context - if so, old texture is invalid
            const isDifferentContext = oldContextId !== undefined &&
                                       oldContextId !== this._borrowedContext.contextId

            // Recreate base texture if:
            // 1. Different context (old texture is invalid)
            // 2. Or texture doesn't exist yet
            if (isDifferentContext) {
                // Destroy old texture (for old context, can't reuse)
                if (this.baseColorTexture) {
                    // Note: This texture was for a different GL context,
                    // we can't properly destroy it, just drop the reference
                    this.baseColorTexture = null
                }
            }

            if (!this.baseColorTexture) {
                this._createBaseTexture()
            }

            // Always refresh shader reference (was cleared on release)
            this.setShader(this.options.shader)

            this._lastContextId = this._borrowedContext.contextId
            this._borrowPending = false

            return true
        } catch (err) {
            console.warn('[ShaderButton] Failed to borrow context:', err)
            this._borrowPending = false
            return false
        }
    }

    /**
     * Set the active shader
     * @param {string} name - Shader name
     */
    setShader(name) {
        this.options.shader = name

        if (!this._resources) return

        const shader = this._resources.getShader(name)
        if (shader) {
            this.activeShader = shader
            this.activeShaderName = name
        } else {
            // Fallback to holographic
            this.activeShader = this._resources.getShader('holographic')
            this.activeShaderName = 'holographic'
        }
    }

    /**
     * Set effect mode
     * @param {string} mode - 'background' or 'border'
     */
    setMode(mode) {
        this.options.mode = mode
    }

    /**
     * Set variant color
     * @param {string|null} variant - Variant name or null
     */
    setVariant(variant) {
        this.options.variant = variant || null
    }

    /**
     * Set border width
     * @param {number} width - Border width (0-0.5)
     */
    setBorderWidth(width) {
        this.options.borderWidth = Math.max(0.02, Math.min(0.5, width))
    }

    /**
     * Update mouse position
     * @param {number} x - Normalized X (-1 to 1)
     * @param {number} y - Normalized Y (-1 to 1)
     */
    setMousePosition(x, y) {
        this.targetMouseX = x
        this.targetMouseY = y
    }

    /**
     * Set hovering state
     * @param {boolean} hovering
     */
    async setHovering(hovering) {
        const wasHovering = this.isHovering
        this.isHovering = hovering

        if (this._releaseTimeout) {
            clearTimeout(this._releaseTimeout)
            this._releaseTimeout = null
        }

        if (hovering && !wasHovering) {
            const gotContext = await this._borrowContext()
            if (gotContext) {
                this.start()
            }
        } else if (!hovering && wasHovering) {
            this.targetMouseX = 0
            this.targetMouseY = 0

            // Don't release if continuously animating
            if (this.isAnimating) return

            this._releaseTimeout = setTimeout(() => {
                this.stop()
                let frames = 0
                const finishUp = () => {
                    if (frames < 20 && !this.isHovering && !this.isAnimating) {
                        frames++
                        this.render(1/60)
                        requestAnimationFrame(finishUp)
                    } else if (!this.isHovering && !this.isAnimating) {
                        this._releaseContext()
                    }
                }
                finishUp()
            }, 100)
        }
    }

    /**
     * Set continuous animation mode (for CTA buttons)
     * @param {boolean} animating
     */
    async setAnimating(animating) {
        const wasAnimating = this.isAnimating
        this.isAnimating = animating

        if (animating && !wasAnimating) {
            // Start continuous animation
            const gotContext = await this._borrowContext()
            if (gotContext) {
                this.start()
            }
        } else if (!animating && wasAnimating && !this.isHovering) {
            // Stop animation and release context (unless hovering)
            this._releaseTimeout = setTimeout(() => {
                if (!this.isAnimating && !this.isHovering) {
                    this.stop()
                    this._releaseContext()
                }
            }, 100)
        }
    }

    /**
     * Start the render loop
     */
    start() {
        if (this.isRunning) return
        this.isRunning = true
        this.lastTime = performance.now()
        this._renderLoop()
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
     */
    render(deltaTime) {
        if (!this.gl || !this.activeShader || !this._borrowedContext || !this._resources) return

        // Check for context loss
        if (this.gl.isContextLost()) {
            console.warn('[ShaderButton] Context lost during render')
            return
        }

        const offscreenCanvas = this._borrowedContext.canvas
        if (!offscreenCanvas || offscreenCanvas.width === 0 || offscreenCanvas.height === 0) return
        if (this.canvas.width === 0 || this.canvas.height === 0) return

        // Ensure we have a base texture
        if (!this.baseColorTexture) {
            console.warn('[ShaderButton] Missing base texture, recreating')
            this._createBaseTexture()
            if (!this.baseColorTexture) return
        }

        const gl = this.gl
        const shader = this.activeShader

        // Smooth hover transition
        const targetHover = this.isHovering ? 1.0 : 0.0
        this.hoverAmount += (targetHover - this.hoverAmount) * 0.1

        // Calculate target focus point
        // When hovering: follow mouse, when animating: oscillate, when resting: use restingFocus
        const restingFocus = this.options.restingFocus || [0,0]//[0.3, 0.8]
        let targetX, targetY

        if (this.isHovering) {
            targetX = this.targetMouseX
            targetY = this.targetMouseY
        } else if (this.isAnimating) {
            // Animate focus point in a smooth figure-8 / lissajous pattern
            targetX = Math.sin(this.time * 0.8) * 0.6
            targetY = Math.sin(this.time * 0.5) * 0.4
        } else {
            targetX = restingFocus[0]
            targetY = restingFocus[1]
        }

        // Smooth mouse/focus movement
        const smoothing = 0.15
        this.mouseX += (targetX - this.mouseX) * smoothing
        this.mouseY += (targetY - this.mouseY) * smoothing

        this.time += deltaTime

        // Setup render state
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, offscreenCanvas.width, offscreenCanvas.height)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        gl.disable(gl.DEPTH_TEST)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        shader.use()

        // Set uniforms
        shader.setUniform1f('u_time', this.time)
        shader.setUniform2f('u_mousePosition', this.mouseX, this.mouseY)

        // Calculate tilt angle with smooth transition between resting and hover
        const restingTilt = this.options.restingTilt || [0.35, 0.15]

        // Resting tilt with time-based animation when animating
        const shimmerAmp = this.isAnimating ? 0.25 : 0.05
        const shimmer = Math.sin(this.time * 0.7) * shimmerAmp
        const restX = restingTilt[0] + shimmer
        const restY = restingTilt[1] + Math.cos(this.time * 0.5) * shimmerAmp * 0.7

        // Mouse-driven tilt
        const hoverX = this.mouseX * 0.5
        const hoverY = this.mouseY * 0.5

        // Blend between resting and hover based on smooth transition
        const tiltX = restX * (1 - this.hoverAmount) + hoverX * this.hoverAmount
        const tiltY = restY * (1 - this.hoverAmount) + hoverY * this.hoverAmount

        shader.setUniform2f('u_cardRotation', tiltX, tiltY)

        shader.setUniform1f('u_maskActive', 1.0)
        shader.setUniform1f('u_textOpacity', 0.0)
        shader.setUniform1f('u_effectScale', this.options.intensity)

        // Variant color
        const variant = this.options.variant
        const variantActive = variant ? 1.0 : 0.0
        const variantColor = variant ? (CONFIG.variants[variant] || [0, 0, 0]) : [0, 0, 0]
        shader.setUniform1f('u_variantActive', variantActive)
        shader.setUniform3f('u_variantColor', variantColor[0], variantColor[1], variantColor[2])

        // Bind textures
        const proceduralTextures = this._borrowedContext.proceduralTextures

        // Base texture
        if (this.baseColorTexture) {
            this.baseColorTexture.bind(TEXTURE_SLOTS.base)
            shader.setUniform1i('u_baseTexture', TEXTURE_SLOTS.base)
        }

        // Procedural textures
        if (proceduralTextures.rainbow) {
            proceduralTextures.rainbow.bind(TEXTURE_SLOTS.rainbow)
            shader.setUniform1i('u_rainbowGradient', TEXTURE_SLOTS.rainbow)
        }
        if (proceduralTextures.noise) {
            proceduralTextures.noise.bind(TEXTURE_SLOTS.noise)
            shader.setUniform1i('u_noiseTexture', TEXTURE_SLOTS.noise)
        }
        if (proceduralTextures.foil) {
            proceduralTextures.foil.bind(TEXTURE_SLOTS.foil)
            shader.setUniform1i('u_foilPattern', TEXTURE_SLOTS.foil)
        }
        if (proceduralTextures.depth) {
            proceduralTextures.depth.bind(TEXTURE_SLOTS.depth)
            shader.setUniform1i('u_depthMap', TEXTURE_SLOTS.depth)
        }

        // Effect mask (from cache)
        const effectMask = this._resources.getMask(this.options.mode, this.options.borderWidth)
        effectMask.bind(TEXTURE_SLOTS.effectMask)
        shader.setUniform1i('u_effectMask', TEXTURE_SLOTS.effectMask)

        // Blank textures for text (buttons don't have text overlays)
        const blank = this._resources.getBlankTexture()
        blank.bind(TEXTURE_SLOTS.text)
        shader.setUniform1i('u_textTexture', TEXTURE_SLOTS.text)
        shader.setUniform1i('u_numberTexture', TEXTURE_SLOTS.text)
        shader.setUniform1i('u_collectionTexture', TEXTURE_SLOTS.text)

        // Draw
        const geometry = this._resources.getGeometry()
        geometry.bind()
        geometry.draw()

        // Copy to target canvas
        this._renderToTarget()
    }

    /**
     * Copy rendered frame to target canvas
     */
    _renderToTarget() {
        if (!this._borrowedContext) return

        const offscreenCanvas = this._borrowedContext.canvas

        if (!this._targetCtx) {
            this._targetCtx = this.canvas.getContext('2d')
        }

        const ctx = this._targetCtx
        if (!ctx) return

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
        ctx.drawImage(offscreenCanvas, 0, 0, this.canvas.width, this.canvas.height)
    }

    /**
     * Main render loop
     */
    _renderLoop() {
        if (!this.isRunning || !this.gl) return

        const currentTime = performance.now()
        const deltaTime = (currentTime - this.lastTime) / 1000
        this.lastTime = currentTime

        this.render(deltaTime)

        this.frameId = requestAnimationFrame(() => this._renderLoop())
    }

    /**
     * Cleanup resources
     */
    _cleanup() {
        // Destroy per-button texture
        if (this.baseColorTexture && this.gl) {
            this.baseColorTexture.destroy()
        }
        this.baseColorTexture = null

        // Return context to pool
        if (this._borrowedContext) {
            this._borrowedContext.release()
            this._borrowedContext = null
        }

        this.gl = null
        this._resources = null
        this.activeShader = null
        this.isInitialized = false
        this._borrowPending = false
    }

    /**
     * Full cleanup and destroy
     */
    destroy() {
        this.stop()

        if (this._releaseTimeout) {
            clearTimeout(this._releaseTimeout)
            this._releaseTimeout = null
        }

        this._cleanup()
    }

    // ==================== Static ====================

    static get shaderNames() {
        return ShaderRegistry.SHADER_NAMES
    }

    static get variantNames() {
        return Object.keys(CONFIG.variants)
    }
}
