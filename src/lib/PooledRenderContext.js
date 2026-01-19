/**
 * PooledRenderContext - A reusable WebGL rendering context
 *
 * Contains shared resources that are expensive to create:
 * - OffscreenCanvas (or hidden canvas fallback)
 * - WebGL2 context
 * - Geometry (shared quad)
 * - ShaderManager (all shaders pre-compiled)
 * - Procedural textures (rainbow, noise, foil, depth)
 *
 * Does NOT contain card-specific resources:
 * - Card base texture
 * - Effect masks
 * - Text textures
 */

import { Geometry } from '../core/Geometry.js'
import { ShaderManager } from '../shaders/ShaderManager.js'
import { createRainbowGradient, createNoiseTexture, createFoilPattern, createDepthMap } from '../core/ProceduralTextures.js'
import * as ShaderRegistry from './ShaderRegistry.js'

export class PooledRenderContext {
    /**
     * @param {number} id - Unique identifier for this pooled context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    constructor(id, width = 400, height = 640) {
        this.id = id
        this.width = width
        this.height = height

        // Canvas and WebGL context
        this.canvas = null
        this.gl = null

        // Shared resources
        this.geometry = null
        this.shaderManager = null
        this.proceduralTextures = {
            rainbow: null,
            noise: null,
            foil: null,
            depth: null
        }

        // State
        this.inUse = false
        this.currentOwner = null
        this.isInitialized = false
    }

    /**
     * Initialize the pooled context with all shared resources
     * @returns {boolean} True if initialization succeeded
     */
    initialize() {
        if (this.isInitialized) return true

        try {
            // Create canvas (prefer OffscreenCanvas, fallback to hidden HTMLCanvasElement)
            this.canvas = this._createCanvas()

            // Create WebGL2 context
            this.gl = this.canvas.getContext('webgl2', {
                antialias: true,
                alpha: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true
            })

            if (!this.gl) {
                console.error(`PooledRenderContext ${this.id}: Failed to create WebGL2 context`)
                return false
            }

            if (this.gl.isContextLost()) {
                console.error(`PooledRenderContext ${this.id}: WebGL context immediately lost`)
                return false
            }

            // Configure GL state
            const gl = this.gl
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
            gl.enable(gl.DEPTH_TEST)
            gl.depthFunc(gl.LEQUAL)
            gl.clearColor(0, 0, 0, 0)
            gl.viewport(0, 0, this.width, this.height)

            // Create shared geometry (card quad)
            this.geometry = new Geometry(this.gl)
            this.geometry.createQuad(1, 1.6) // 5:8 aspect ratio

            // Create shader manager and compile all shaders
            this.shaderManager = new ShaderManager(this.gl, {
                useBundled: true,
                shaderRegistry: ShaderRegistry
            })
            this.shaderManager.loadAllFromRegistry()

            // Create procedural textures
            this.proceduralTextures.rainbow = createRainbowGradient(this.gl)
            this.proceduralTextures.noise = createNoiseTexture(this.gl)
            this.proceduralTextures.foil = createFoilPattern(this.gl)
            this.proceduralTextures.depth = createDepthMap(this.gl)

            this.isInitialized = true
            return true

        } catch (err) {
            console.error(`PooledRenderContext ${this.id}: Initialization failed`, err)
            this._cleanup()
            return false
        }
    }

    /**
     * Create a canvas for rendering
     * @returns {OffscreenCanvas|HTMLCanvasElement}
     */
    _createCanvas() {
        // Prefer OffscreenCanvas if available
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(this.width, this.height)
        }

        // Fallback: create a hidden HTMLCanvasElement
        const canvas = document.createElement('canvas')
        canvas.width = this.width
        canvas.height = this.height
        canvas.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden;pointer-events:none'
        document.body.appendChild(canvas)
        return canvas
    }

    /**
     * Resize the canvas
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        if (!this.canvas || !this.gl) return

        this.width = width
        this.height = height
        this.canvas.width = width
        this.canvas.height = height
        this.gl.viewport(0, 0, width, height)
    }

    /**
     * Assign this context to an owner (Stikker instance)
     * @param {object} owner - The owner requesting this context
     */
    assignTo(owner) {
        this.inUse = true
        this.currentOwner = owner
    }

    /**
     * Release this context back to the pool
     */
    release() {
        this.inUse = false
        this.currentOwner = null

        // Clear the canvas for next user
        if (this.gl && !this.gl.isContextLost()) {
            this.gl.clearColor(0, 0, 0, 0)
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
        }
    }

    /**
     * Check if context is still valid
     * @returns {boolean}
     */
    isValid() {
        return this.gl && !this.gl.isContextLost() && this.isInitialized
    }

    /**
     * Clean up partial initialization
     */
    _cleanup() {
        this.geometry?.destroy()
        this.shaderManager?.destroy()

        // Clean up procedural textures
        for (const texture of Object.values(this.proceduralTextures)) {
            texture?.destroy?.()
        }

        this.geometry = null
        this.shaderManager = null
        this.proceduralTextures = {
            rainbow: null,
            noise: null,
            foil: null,
            depth: null
        }
    }

    /**
     * Full cleanup and destroy
     */
    destroy() {
        this._cleanup()

        // Release WebGL context
        if (this.gl) {
            try {
                const ext = this.gl.getExtension('WEBGL_lose_context')
                if (ext) {
                    ext.loseContext()
                }
            } catch (e) {
                // Context may already be lost
            }
        }

        // Remove hidden canvas from DOM if it's an HTMLCanvasElement
        if (this.canvas instanceof HTMLCanvasElement && this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas)
        }

        this.gl = null
        this.canvas = null
        this.isInitialized = false
        this.inUse = false
        this.currentOwner = null
    }
}
