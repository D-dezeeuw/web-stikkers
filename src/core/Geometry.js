export class Geometry {
    constructor(gl) {
        this.gl = gl
        this.vao = null
        this.vbo = null
        this.ebo = null
        this.indexCount = 0
    }

    createQuad(width = 1, height = 1.4) {
        const gl = this.gl
        const hw = width / 2
        const hh = height / 2

        // Vertices: position (3), uv (2), normal (3), tangent (3) = 11 floats per vertex
        // UV.y is flipped to match canvas/image origin (top-left) with OpenGL convention
        const vertices = new Float32Array([
            // Position          UV          Normal       Tangent
            -hw, -hh, 0,    0, 1,      0, 0, 1,     1, 0, 0,   // Bottom-left
             hw, -hh, 0,    1, 1,      0, 0, 1,     1, 0, 0,   // Bottom-right
             hw,  hh, 0,    1, 0,      0, 0, 1,     1, 0, 0,   // Top-right
            -hw,  hh, 0,    0, 0,      0, 0, 1,     1, 0, 0    // Top-left
        ])

        const indices = new Uint16Array([
            0, 1, 2,  // First triangle
            0, 2, 3   // Second triangle
        ])

        this.indexCount = indices.length

        // Create VAO (WebGL 2.0)
        this.vao = gl.createVertexArray()
        gl.bindVertexArray(this.vao)

        // Create VBO
        this.vbo = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        // Create EBO
        this.ebo = gl.createBuffer()
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo)
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)

        const stride = 11 * 4  // 11 floats * 4 bytes

        // Position attribute (location 0)
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0)

        // UV attribute (location 1)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 3 * 4)

        // Normal attribute (location 2)
        gl.enableVertexAttribArray(2)
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 5 * 4)

        // Tangent attribute (location 3)
        gl.enableVertexAttribArray(3)
        gl.vertexAttribPointer(3, 3, gl.FLOAT, false, stride, 8 * 4)

        // Unbind VAO
        gl.bindVertexArray(null)

        return this
    }

    bind() {
        this.gl.bindVertexArray(this.vao)
    }

    /**
     * Unbind the VAO (optional - only needed if other code expects unbound state)
     * Note: Skipping unbind is a minor optimization since we rebind at start of next frame
     */
    unbind() {
        this.gl.bindVertexArray(null)
    }

    draw() {
        this.gl.drawElements(this.gl.TRIANGLES, this.indexCount, this.gl.UNSIGNED_SHORT, 0)
    }

    destroy() {
        const gl = this.gl
        if (this.vao) gl.deleteVertexArray(this.vao)
        if (this.vbo) gl.deleteBuffer(this.vbo)
        if (this.ebo) gl.deleteBuffer(this.ebo)
    }
}
