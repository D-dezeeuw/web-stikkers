/**
 * WebGLContextPool - Manages a pool of reusable WebGL contexts
 *
 * Solves the browser WebGL context limit problem by:
 * 1. Maintaining a fixed pool of contexts (default: 6)
 * 2. Components borrow contexts on hover, return on mouse leave
 * 3. If all contexts are in use, requests are queued
 *
 * Usage:
 *   const pool = WebGLContextPool.getInstance()
 *   const borrowed = await pool.borrow(this)
 *   // Use borrowed.gl, borrowed.geometry, borrowed.shaderManager, etc.
 *   borrowed.release()
 */

import { PooledRenderContext } from './PooledRenderContext.js'

// Default pool configuration
// Note: Most browsers limit active WebGL contexts. 5 is a safe default.
const DEFAULT_POOL_SIZE = 5
const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 640

class WebGLContextPool {
    static instance = null

    /**
     * Get the singleton instance
     * @returns {WebGLContextPool}
     */
    static getInstance() {
        if (!WebGLContextPool.instance) {
            WebGLContextPool.instance = new WebGLContextPool()
        }
        return WebGLContextPool.instance
    }

    /**
     * Reset the singleton (for testing)
     */
    static reset() {
        if (WebGLContextPool.instance) {
            WebGLContextPool.instance.destroy()
            WebGLContextPool.instance = null
        }
    }

    constructor() {
        this.pool = []           // Array of PooledRenderContext
        this.requestQueue = []   // Array of { requester, resolve, reject }
        this.isInitialized = false
        this.poolSize = DEFAULT_POOL_SIZE
    }

    /**
     * Initialize the pool with a number of contexts
     * @param {Object} options - Configuration options
     * @param {number} options.poolSize - Number of contexts in the pool
     * @param {number} options.width - Canvas width
     * @param {number} options.height - Canvas height
     */
    async initialize(options = {}) {
        if (this.isInitialized) return

        const poolSize = options.poolSize ?? DEFAULT_POOL_SIZE
        const width = options.width ?? DEFAULT_WIDTH
        const height = options.height ?? DEFAULT_HEIGHT

        this.poolSize = poolSize

        // Create pool of contexts
        for (let i = 0; i < poolSize; i++) {
            const context = new PooledRenderContext(i, width, height)
            const success = context.initialize()

            if (success) {
                this.pool.push(context)
            } else {
                console.warn(`WebGLContextPool: Failed to create context ${i}`)
                // Continue with fewer contexts if some fail
            }
        }

        if (this.pool.length === 0) {
            throw new Error('WebGLContextPool: Failed to create any WebGL contexts')
        }

        this.isInitialized = true
    }

    /**
     * Borrow a context from the pool
     * @param {object} requester - The object requesting the context
     * @returns {Promise<BorrowedContext>} Resolves with borrowed context info
     */
    async borrow(requester) {
        // Lazy initialization
        if (!this.isInitialized) {
            await this.initialize()
        }

        // Find an available context
        const available = this.pool.find(ctx => !ctx.inUse && ctx.isValid())

        if (available) {
            return this._assignContext(available, requester)
        }

        // No context available - queue the request
        return new Promise((resolve, reject) => {
            this.requestQueue.push({ requester, resolve, reject })
        })
    }

    /**
     * Assign a context to a requester
     * @param {PooledRenderContext} context
     * @param {object} requester
     * @returns {BorrowedContext}
     */
    _assignContext(context, requester) {
        context.assignTo(requester)

        return {
            contextId: context.id,
            gl: context.gl,
            canvas: context.canvas,
            geometry: context.geometry,
            shaderManager: context.shaderManager,
            proceduralTextures: context.proceduralTextures,
            resize: (w, h) => context.resize(w, h),
            release: () => this.release(context.id, requester)
        }
    }

    /**
     * Release a borrowed context back to the pool
     * @param {number} contextId - The context ID to release
     * @param {object} requester - The object that borrowed the context (for validation)
     */
    release(contextId, requester) {
        const context = this.pool.find(ctx => ctx.id === contextId)

        if (!context) {
            console.warn(`WebGLContextPool: Unknown context ID ${contextId}`)
            return
        }

        // Validate that the requester is the current owner
        if (context.currentOwner !== requester) {
            console.warn(`WebGLContextPool: Release called by non-owner for context ${contextId}`)
            return
        }

        // Release the context
        context.release()

        // Process next item in queue if any
        this._processQueue()
    }

    /**
     * Process the next item in the request queue
     */
    _processQueue() {
        if (this.requestQueue.length === 0) return

        // Find an available context
        const available = this.pool.find(ctx => !ctx.inUse && ctx.isValid())

        if (available) {
            const { requester, resolve } = this.requestQueue.shift()
            const borrowed = this._assignContext(available, requester)
            resolve(borrowed)
        }
    }

    /**
     * Cancel a pending borrow request (e.g., when component disconnects)
     * @param {object} requester - The requester to remove from queue
     */
    cancelRequest(requester) {
        const index = this.requestQueue.findIndex(item => item.requester === requester)
        if (index !== -1) {
            const { reject } = this.requestQueue[index]
            this.requestQueue.splice(index, 1)
            reject(new Error('Borrow request cancelled'))
        }
    }

    /**
     * Force release a context owned by a specific requester
     * Used when a component disconnects without proper cleanup
     * @param {object} requester
     */
    forceReleaseFor(requester) {
        const context = this.pool.find(ctx => ctx.currentOwner === requester)
        if (context) {
            context.release()
            this._processQueue()
        }
    }

    /**
     * Get pool statistics
     * @returns {Object}
     */
    getStats() {
        const inUse = this.pool.filter(ctx => ctx.inUse).length
        const available = this.pool.filter(ctx => !ctx.inUse && ctx.isValid()).length
        const invalid = this.pool.filter(ctx => !ctx.isValid()).length

        return {
            total: this.pool.length,
            inUse,
            available,
            invalid,
            queueLength: this.requestQueue.length
        }
    }

    /**
     * Clean up all contexts and reset the pool
     */
    destroy() {
        // Reject all pending requests
        for (const { reject } of this.requestQueue) {
            reject(new Error('WebGLContextPool destroyed'))
        }
        this.requestQueue = []

        // Destroy all contexts
        for (const context of this.pool) {
            context.destroy()
        }
        this.pool = []

        this.isInitialized = false
    }
}

/**
 * @typedef {Object} BorrowedContext
 * @property {number} contextId - Unique ID of this context
 * @property {WebGL2RenderingContext} gl - The WebGL2 context
 * @property {OffscreenCanvas|HTMLCanvasElement} canvas - The canvas element
 * @property {Geometry} geometry - Shared geometry instance
 * @property {ShaderManager} shaderManager - Shared shader manager
 * @property {Object} proceduralTextures - Shared procedural textures
 * @property {Function} resize - Resize the context canvas
 * @property {Function} release - Release this context back to the pool
 */

export { WebGLContextPool }
