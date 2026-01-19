import { ShaderProgram } from '../core/ShaderProgram.js'
import { loadShaderSource } from '../utils/ShaderLoader.js'

export class ShaderManager {
    constructor(gl, options = {}) {
        this.gl = gl
        this.shaders = new Map()
        this.activeShader = null
        this.activeShaderName = null
        this.useBundled = options.useBundled ?? false
        this.shaderRegistry = options.shaderRegistry ?? null
    }

    /**
     * Load shader from bundled registry (no network requests)
     */
    loadShaderFromRegistry(name) {
        if (!this.shaderRegistry) {
            throw new Error('Shader registry not provided')
        }

        const { getShaderPair, BASE_VERTEX } = this.shaderRegistry
        const { vertex, fragment } = getShaderPair(name)

        const program = new ShaderProgram(this.gl, vertex, fragment)
        this.shaders.set(name, program)

        return program
    }

    /**
     * Load all card shaders from bundled registry
     */
    loadAllFromRegistry() {
        if (!this.shaderRegistry) {
            throw new Error('Shader registry not provided')
        }

        const { SHADER_NAMES } = this.shaderRegistry
        for (const name of SHADER_NAMES) {
            this.loadShaderFromRegistry(name)
        }
    }

    /**
     * Load shader from file paths (original fetch-based method)
     */
    async loadShader(name, vertexPath, fragmentPath) {
        // If using bundled mode and registry is available, use it
        if (this.useBundled && this.shaderRegistry) {
            return this.loadShaderFromRegistry(name)
        }

        // Otherwise fetch from files
        const [vertexSource, fragmentSource] = await Promise.all([
            loadShaderSource(vertexPath),
            loadShaderSource(fragmentPath)
        ])

        const program = new ShaderProgram(this.gl, vertexSource, fragmentSource)
        this.shaders.set(name, program)

        return program
    }

    register(name, program) {
        this.shaders.set(name, program)
    }

    use(name) {
        const shader = this.shaders.get(name)
        if (!shader) {
            console.warn(`Shader '${name}' not found`)
            return null
        }

        this.activeShader = shader
        this.activeShaderName = name
        shader.use()

        return shader
    }

    getActive() {
        return this.activeShader
    }

    getActiveName() {
        return this.activeShaderName
    }

    get(name) {
        return this.shaders.get(name)
    }

    has(name) {
        return this.shaders.has(name)
    }

    getNames() {
        return Array.from(this.shaders.keys())
    }

    destroy() {
        for (const shader of this.shaders.values()) {
            shader.destroy()
        }
        this.shaders.clear()
        this.activeShader = null
        this.activeShaderName = null
    }
}
