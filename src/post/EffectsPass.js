import { ShaderProgram } from '../core/ShaderProgram.js'

export class EffectsPass {
    constructor(gl) {
        this.gl = gl
        this.shader = null
        this.width = 0
        this.height = 0

        // Framebuffer for when bloom is disabled
        this.sceneFBO = null

        // Fullscreen quad (reuse pattern from BloomPass)
        this.quadVAO = null
        this.quadVBO = null

        // Enable float buffer extension
        gl.getExtension('EXT_color_buffer_float')

        this.createQuad()
    }

    createQuad() {
        const gl = this.gl

        const vertices = new Float32Array([
            -1, -1,  0, 0,
             1, -1,  1, 0,
             1,  1,  1, 1,
            -1, -1,  0, 0,
             1,  1,  1, 1,
            -1,  1,  0, 1
        ])

        this.quadVAO = gl.createVertexArray()
        this.quadVBO = gl.createBuffer()

        gl.bindVertexArray(this.quadVAO)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO)
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)

        gl.bindVertexArray(null)
    }

    async loadShader() {
        this.shader = new ShaderProgram(this.gl)
        await this.shader.load(
            'src/shaders/post/fullscreen.vert.glsl',
            'src/shaders/post/effects.frag.glsl'
        )
    }

    createFramebuffer(width, height) {
        const gl = this.gl

        const fbo = gl.createFramebuffer()
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)

        const texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)

        // Depth buffer for card rendering
        const depthBuffer = gl.createRenderbuffer()
        gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height)
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        return { fbo, texture, depthBuffer, width, height }
    }

    resize(width, height) {
        if (this.width === width && this.height === height) return

        this.width = width
        this.height = height

        const gl = this.gl

        // Delete old framebuffer
        if (this.sceneFBO) {
            gl.deleteFramebuffer(this.sceneFBO.fbo)
            gl.deleteTexture(this.sceneFBO.texture)
            if (this.sceneFBO.depthBuffer) gl.deleteRenderbuffer(this.sceneFBO.depthBuffer)
        }

        this.sceneFBO = this.createFramebuffer(width, height)
    }

    // Begin rendering scene to our framebuffer (used when bloom is disabled)
    beginSceneRender() {
        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fbo)
        gl.viewport(0, 0, this.width, this.height)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        // Disable blending so alpha channel is written directly as bloom mask
        // (otherwise SRC_ALPHA blend makes alpha=0 pixels invisible)
        gl.disable(gl.BLEND)
    }

    endSceneRender() {
        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        // Restore blending for subsequent passes
        gl.enable(gl.BLEND)
    }

    // Apply effects to the scene texture and render to screen
    render(sceneTexture, effectSettings) {
        const gl = this.gl

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.width, this.height)
        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)  // Fullscreen quad replaces all pixels, no blending needed

        this.shader.use()

        // Bind scene texture
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, sceneTexture)
        this.shader.setUniform1i('u_scene', 0)

        // Set effect uniforms
        this.shader.setUniform1f('u_hdrEnabled', effectSettings.hdrEnabled ? 1.0 : 0.0)
        this.shader.setUniform1f('u_saturationBoost', effectSettings.saturationBoostEnabled ? 1.0 : 0.0)

        // Draw fullscreen quad
        gl.bindVertexArray(this.quadVAO)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.bindVertexArray(null)

        gl.enable(gl.DEPTH_TEST)
        gl.enable(gl.BLEND)  // Restore for next frame
    }

    // Get our scene texture for when we need to pass it to another pass
    getSceneTexture() {
        return this.sceneFBO?.texture
    }

    destroy() {
        const gl = this.gl

        if (this.quadVAO) gl.deleteVertexArray(this.quadVAO)
        if (this.quadVBO) gl.deleteBuffer(this.quadVBO)

        if (this.sceneFBO) {
            gl.deleteFramebuffer(this.sceneFBO.fbo)
            gl.deleteTexture(this.sceneFBO.texture)
            if (this.sceneFBO.depthBuffer) gl.deleteRenderbuffer(this.sceneFBO.depthBuffer)
        }

        if (this.shader) this.shader.destroy()
    }
}
