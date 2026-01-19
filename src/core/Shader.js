import { ShaderProgram } from './ShaderProgram.js'
import { loadShaderSource } from '../utils/ShaderLoader.js'

export class Shader {
    constructor(gl) {
        this.gl = gl
        this.program = null
    }

    async load(vertexPath, fragmentPath) {
        const [vertexSource, fragmentSource] = await Promise.all([
            loadShaderSource(vertexPath),
            loadShaderSource(fragmentPath)
        ])

        this.program = new ShaderProgram(this.gl, vertexSource, fragmentSource)
    }

    use() {
        if (this.program) {
            this.program.use()
        }
    }

    setUniform1i(name, value) {
        if (this.program) {
            this.program.setUniform1i(name, value)
        }
    }

    setUniform1f(name, value) {
        if (this.program) {
            this.program.setUniform1f(name, value)
        }
    }

    setUniform2f(name, x, y) {
        if (this.program) {
            this.program.setUniform2f(name, x, y)
        }
    }

    setUniform3f(name, x, y, z) {
        if (this.program) {
            this.program.setUniform3f(name, x, y, z)
        }
    }

    destroy() {
        if (this.program) {
            this.program.destroy()
            this.program = null
        }
    }
}
