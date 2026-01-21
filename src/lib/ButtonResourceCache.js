/**
 * ButtonResourceCache - Singleton cache for shared button resources
 *
 * Provides pooled resources for shader buttons without modifying the core
 * ShaderRegistry, ShaderManager, or mask systems. Resources are cached
 * per GL context and shared across all button instances.
 *
 * Cached resources:
 * - Button geometry (clip-space quad, shared by all buttons)
 * - Button shader programs (button vertex + card fragments)
 * - Effect mask textures (full/border modes)
 */

import { ShaderProgram } from '../core/ShaderProgram.js'
import { Texture } from '../core/Texture.js'
import * as ShaderRegistry from './ShaderRegistry.js'

// Button vertex shader - flat 2D, no transforms
// Fills clip space (-1 to 1), maps UV to 0-1
const BUTTON_VERTEX = `#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec3 a_normal;
layout(location = 3) in vec3 a_tangent;

out vec2 v_uv;
out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 v_viewDirection;
out vec3 v_tangentViewDir;
out vec3 v_tangent;
out vec3 v_bitangent;
out float v_depth;

void main() {
    gl_Position = vec4(a_position, 1.0);
    v_uv = a_uv;
    v_worldPosition = vec3(a_uv * 2.0 - 1.0, 0.0);
    v_worldNormal = vec3(0.0, 0.0, 1.0);
    v_viewDirection = vec3(0.0, 0.0, 1.0);
    v_tangentViewDir = vec3(0.0, 0.0, 1.0);
    v_tangent = vec3(1.0, 0.0, 0.0);
    v_bitangent = vec3(0.0, 1.0, 0.0);
    v_depth = 0.5;
}
`

// Texture slot assignments (must match shader expectations)
const TEXTURE_SLOTS = {
    base: 0,
    rainbow: 1,
    noise: 2,
    foil: 3,
    depth: 4,
    effectMask: 5,
    text: 6,      // Reuse effectMask for blank
    number: 7,    // Reuse effectMask for blank
    collection: 8 // Reuse effectMask for blank
}

/**
 * Per-context resource cache
 */
class ContextResources {
    constructor(gl) {
        this.gl = gl
        this.geometry = null
        this.shaders = new Map()
        this.masks = new Map()
        this.blankTexture = null
    }

    /**
     * Get or create shared geometry
     */
    getGeometry() {
        if (!this.geometry) {
            this.geometry = this._createButtonGeometry()
        }
        return this.geometry
    }

    /**
     * Create button geometry (clip-space quad)
     */
    _createButtonGeometry() {
        const gl = this.gl

        // Vertices: position (3), uv (2), normal (3), tangent (3) = 11 floats
        // Same layout as card Geometry for shader compatibility
        const vertices = new Float32Array([
            // Position     UV        Normal       Tangent
            -1, -1, 0,    0, 1,    0, 0, 1,    1, 0, 0,   // Bottom-left
             1, -1, 0,    1, 1,    0, 0, 1,    1, 0, 0,   // Bottom-right
             1,  1, 0,    1, 0,    0, 0, 1,    1, 0, 0,   // Top-right
            -1,  1, 0,    0, 0,    0, 0, 1,    1, 0, 0    // Top-left
        ])

        const indices = new Uint16Array([0, 1, 2, 0, 2, 3])

        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)

        const vbo = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        const ebo = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

        const stride = 11 * 4

        // Position (location 0)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)

        // UV (location 1)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 3 * 4)

        // Normal (location 2)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 5 * 4)

        // Tangent (location 3)
        gl.enableVertexAttribArray(3)
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 8 * 4)

        gl.bindVertexArray(null)

        return {
            vao,
            vbo,
            ebo,
            indexCount: indices.length,
            bind() { gl.bindVertexArray(vao) },
            draw() { gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0) },
            destroy() {
                gl.deleteVertexArray(vao)
                gl.deleteBuffer(vbo)
                gl.deleteBuffer(ebo)
            }
        }
    }

    /**
     * Get or create shader program for a given shader name
     */
    getShader(name) {
        if (this.shaders.has(name)) {
            return this.shaders.get(name)
        }

        const shader = this._compileShader(name)
        if (shader) {
            this.shaders.set(name, shader)
        }
        return shader
    }

    /**
     * Compile a button shader (button vertex + card fragment)
     */
    _compileShader(name) {
        const { CARD_SHADERS } = ShaderRegistry
        const cardShader = CARD_SHADERS[name]

        if (!cardShader || !cardShader.fragment) {
            console.warn(`ButtonResourceCache: No fragment shader for '${name}'`)
            return null
        }

        try {
            return new ShaderProgram(this.gl, BUTTON_VERTEX, cardShader.fragment)
        } catch (err) {
            console.error(`ButtonResourceCache: Failed to compile '${name}':`, err.message)
            return null
        }
    }

    /**
     * Get or create effect mask texture
     * @param {string} mode - 'background' (full effect) or 'border' (border only)
     * @param {number} borderWidth - Border width for 'border' mode (0-0.5)
     */
    getMask(mode, borderWidth = 0.06) {
        // For background mode, always return the same full mask
        // For border mode, cache by rounded border width to avoid too many textures
        const isBorder = mode === 'border'
        const key = isBorder ? `border_${Math.round(borderWidth * 100)}` : 'background'

        if (this.masks.has(key)) {
            return this.masks.get(key)
        }

        const mask = this._createMask(isBorder, borderWidth)
        this.masks.set(key, mask)
        return mask
    }

    /**
     * Create effect mask texture
     */
    _createMask(isBorder, borderWidth) {
        const gl = this.gl
        const size = 256

        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        if (isBorder) {
            // Border mode: white border, black center (effect only on border)
            const border = borderWidth * size
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, size, size)
            ctx.fillStyle = '#000000'
            ctx.fillRect(border, border, size - border * 2, size - border * 2)
        } else {
            // Background mode: full white (effect everywhere)
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, size, size)
        }

        const texture = new Texture(gl)
        texture.createFromImage(canvas)
        return texture
    }

    /**
     * Get blank texture for unused text slots
     */
    getBlankTexture() {
        if (this.blankTexture) {
            return this.blankTexture
        }

        const gl = this.gl
        const canvas = document.createElement('canvas')
        canvas.width = 4
        canvas.height = 4
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, 4, 4)

        this.blankTexture = new Texture(gl)
        this.blankTexture.createFromImage(canvas)
        return this.blankTexture
    }

    /**
     * Destroy all resources for this context
     */
    destroy() {
        this.geometry?.destroy()
        this.geometry = null

        for (const shader of this.shaders.values()) {
            shader.destroy()
        }
        this.shaders.clear()

        for (const mask of this.masks.values()) {
            mask.destroy()
        }
        this.masks.clear()

        this.blankTexture?.destroy()
        this.blankTexture = null
    }
}

/**
 * ButtonResourceCache singleton
 * Uses WeakMap to track resources per GL context
 */
class ButtonResourceCache {
    static instance = null

    static getInstance() {
        if (!ButtonResourceCache.instance) {
            ButtonResourceCache.instance = new ButtonResourceCache()
        }
        return ButtonResourceCache.instance
    }

    constructor() {
        // WeakMap keyed by GL context - automatically cleans up when context is GC'd
        this._contextResources = new WeakMap()
    }

    /**
     * Get resources for a GL context
     * @param {WebGL2RenderingContext} gl
     * @returns {ContextResources}
     */
    getResources(gl) {
        if (!this._contextResources.has(gl)) {
            this._contextResources.set(gl, new ContextResources(gl))
        }
        return this._contextResources.get(gl)
    }

    /**
     * Release resources for a GL context
     * @param {WebGL2RenderingContext} gl
     */
    releaseResources(gl) {
        if (this._contextResources.has(gl)) {
            this._contextResources.get(gl).destroy()
            this._contextResources.delete(gl)
        }
    }
}

export { ButtonResourceCache, TEXTURE_SLOTS, BUTTON_VERTEX }
