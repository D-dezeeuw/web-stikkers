import { loadShaderSource } from '../utils/ShaderLoader.js'

export class ShaderProgram {
    constructor(gl, vertexSource = null, fragmentSource = null) {
        this.gl = gl
        this.program = null
        this.uniformLocations = new Map()
        this.attributeLocations = new Map()

        // Only compile if sources provided (supports deferred loading)
        if (vertexSource && fragmentSource) {
            this.compile(vertexSource, fragmentSource)
        }
    }

    async load(vertexPath, fragmentPath) {
        const [vertexSource, fragmentSource] = await Promise.all([
            loadShaderSource(vertexPath),
            loadShaderSource(fragmentPath)
        ])
        this.compile(vertexSource, fragmentSource)
        return this
    }

    compile(vertexSource, fragmentSource) {
        const gl = this.gl

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource)
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource)

        this.program = gl.createProgram()
        gl.attachShader(this.program, vertexShader)
        gl.attachShader(this.program, fragmentShader)
        gl.linkProgram(this.program)

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            const error = gl.getProgramInfoLog(this.program)
            gl.deleteProgram(this.program)
            throw new Error('Shader program linking failed: ' + error)
        }

        gl.deleteShader(vertexShader)
        gl.deleteShader(fragmentShader)
    }

    compileShader(type, source) {
        const gl = this.gl
        const shader = gl.createShader(type)

        gl.shaderSource(shader, source)
        gl.compileShader(shader)

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader)
            const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'
            gl.deleteShader(shader)
            throw new Error(`${typeName} shader compilation failed: ${error}`)
        }

        return shader
    }

    use() {
        this.gl.useProgram(this.program)
    }

    getUniformLocation(name) {
        if (!this.uniformLocations.has(name)) {
            const location = this.gl.getUniformLocation(this.program, name)
            this.uniformLocations.set(name, location)
        }
        return this.uniformLocations.get(name)
    }

    getAttribLocation(name) {
        if (!this.attributeLocations.has(name)) {
            const location = this.gl.getAttribLocation(this.program, name)
            this.attributeLocations.set(name, location)
        }
        return this.attributeLocations.get(name)
    }

    setUniform1f(name, value) {
        const location = this.getUniformLocation(name)
        if (location !== null) {
            this.gl.uniform1f(location, value)
        }
    }

    setUniform2f(name, x, y) {
        const location = this.getUniformLocation(name)
        if (location !== null) {
            this.gl.uniform2f(location, x, y)
        }
    }

    setUniform3f(name, x, y, z) {
        const location = this.getUniformLocation(name)
        if (location !== null) {
            this.gl.uniform3f(location, x, y, z)
        }
    }

    setUniform4f(name, x, y, z, w) {
        const location = this.getUniformLocation(name)
        if (location !== null) {
            this.gl.uniform4f(location, x, y, z, w)
        }
    }

    setUniform1i(name, value) {
        const location = this.getUniformLocation(name)
        if (location !== null) {
            this.gl.uniform1i(location, value)
        }
    }

    setUniformMatrix4fv(name, matrix) {
        const location = this.getUniformLocation(name)
        if (location !== null) {
            this.gl.uniformMatrix4fv(location, false, matrix)
        }
    }

    destroy() {
        if (this.program) {
            this.gl.deleteProgram(this.program)
            this.program = null
        }
        this.uniformLocations.clear()
        this.attributeLocations.clear()
    }
}
