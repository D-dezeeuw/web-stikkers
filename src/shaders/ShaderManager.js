import { ShaderProgram } from '../core/ShaderProgram.js'
import { loadShaderSource } from '../utils/ShaderLoader.js'

export class ShaderManager {
    constructor(gl) {
        this.gl = gl
        this.shaders = new Map()
        this.activeShader = null
        this.activeShaderName = null
    }

    async loadShader(name, vertexPath, fragmentPath) {
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
