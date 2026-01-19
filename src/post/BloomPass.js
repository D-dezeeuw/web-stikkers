import { Shader } from '../core/Shader.js'

export class BloomPass {
    constructor(gl) {
        this.gl = gl
        this.enabled = false
        this.threshold = 0.6
        this.intensity = 1.6
        this.radius = 3.0

        // Enable float buffer extension for RGBA16F framebuffers
        const ext = gl.getExtension('EXT_color_buffer_float')
        if (!ext) {
            console.warn('EXT_color_buffer_float not supported, bloom may not work correctly')
        }

        this.width = 0
        this.height = 0

        // Shaders will be loaded externally
        this.extractShader = null
        this.blurShader = null
        this.compositeShader = null

        // Framebuffers
        this.sceneFBO = null
        this.brightFBO = null
        this.blurFBO1 = null
        this.blurFBO2 = null

        // Fullscreen quad
        this.quadVAO = null
        this.quadVBO = null

        this.createQuad()
    }

    createQuad() {
        const gl = this.gl

        // Fullscreen quad vertices (position + uv)
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

        // Position attribute
        gl.enableVertexAttribArray(0)
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)

        // UV attribute
        gl.enableVertexAttribArray(1)
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)

        gl.bindVertexArray(null)
    }

    async loadShaders() {
        const gl = this.gl
        const vertPath = 'src/shaders/post/fullscreen.vert.glsl'

        this.extractShader = new Shader(gl)
        await this.extractShader.load(vertPath, 'src/shaders/post/bloom-extract.frag.glsl')

        this.blurShader = new Shader(gl)
        await this.blurShader.load(vertPath, 'src/shaders/post/blur.frag.glsl')

        this.compositeShader = new Shader(gl)
        await this.compositeShader.load(vertPath, 'src/shaders/post/composite.frag.glsl')
    }

    createFramebuffer(width, height, withDepth = false) {
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

        let depthBuffer = null
        if (withDepth) {
            depthBuffer = gl.createRenderbuffer()
            gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer)
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, width, height)
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        return { fbo, texture, depthBuffer, width, height }
    }

    resize(width, height) {
        if (this.width === width && this.height === height) return

        this.width = width
        this.height = height

        const gl = this.gl

        // Delete old framebuffers
        if (this.sceneFBO) {
            gl.deleteFramebuffer(this.sceneFBO.fbo)
            gl.deleteTexture(this.sceneFBO.texture)
            if (this.sceneFBO.depthBuffer) gl.deleteRenderbuffer(this.sceneFBO.depthBuffer)
        }
        if (this.brightFBO) {
            gl.deleteFramebuffer(this.brightFBO.fbo)
            gl.deleteTexture(this.brightFBO.texture)
        }
        if (this.blurFBO1) {
            gl.deleteFramebuffer(this.blurFBO1.fbo)
            gl.deleteTexture(this.blurFBO1.texture)
        }
        if (this.blurFBO2) {
            gl.deleteFramebuffer(this.blurFBO2.fbo)
            gl.deleteTexture(this.blurFBO2.texture)
        }

        // Create new framebuffers (scene needs depth for card rendering)
        this.sceneFBO = this.createFramebuffer(width, height, true)

        // Bloom at half resolution for performance
        const bloomWidth = Math.floor(width / 2)
        const bloomHeight = Math.floor(height / 2)
        this.brightFBO = this.createFramebuffer(bloomWidth, bloomHeight)
        this.blurFBO1 = this.createFramebuffer(bloomWidth, bloomHeight)
        this.blurFBO2 = this.createFramebuffer(bloomWidth, bloomHeight)
    }

    beginSceneRender() {
        if (!this.enabled || !this.sceneFBO) return

        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fbo)
        gl.viewport(0, 0, this.width, this.height)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    }

    endSceneRender() {
        if (!this.enabled) return

        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    renderBloom() {
        if (!this.enabled || !this.extractShader) return

        const gl = this.gl
        const bloomWidth = this.blurFBO1.width
        const bloomHeight = this.blurFBO1.height

        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)

        // Clear bloom FBOs with transparent black
        gl.clearColor(0, 0, 0, 0)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFBO.fbo)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.fbo)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO2.fbo)
        gl.clear(gl.COLOR_BUFFER_BIT)

        // 1. Extract bright areas
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightFBO.fbo)
        gl.viewport(0, 0, bloomWidth, bloomHeight)

        this.extractShader.use()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture)
        this.extractShader.setUniform1i('u_texture', 0)
        this.extractShader.setUniform1f('u_threshold', this.threshold)

        this.drawQuad()

        // 2. Horizontal blur
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.fbo)

        this.blurShader.use()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.brightFBO.texture)
        this.blurShader.setUniform1i('u_texture', 0)
        this.blurShader.setUniform2f('u_direction', 1.0 / bloomWidth, 0.0)
        this.blurShader.setUniform1f('u_radius', this.radius)

        this.drawQuad()

        // 3. Vertical blur
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO2.fbo)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.blurFBO1.texture)
        this.blurShader.setUniform2f('u_direction', 0.0, 1.0 / bloomHeight)

        this.drawQuad()

        // 4. Second blur pass for more spread
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.fbo)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.blurFBO2.texture)
        this.blurShader.setUniform2f('u_direction', 1.0 / bloomWidth, 0.0)
        this.blurShader.setUniform1f('u_radius', this.radius * 2.0)

        this.drawQuad()

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO2.fbo)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.blurFBO1.texture)
        this.blurShader.setUniform2f('u_direction', 0.0, 1.0 / bloomHeight)

        this.drawQuad()

        // 5. Third blur pass for edge spillover
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO1.fbo)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.blurFBO2.texture)
        this.blurShader.setUniform2f('u_direction', 1.0 / bloomWidth, 0.0)
        this.blurShader.setUniform1f('u_radius', this.radius * 4.0)

        this.drawQuad()

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurFBO2.fbo)

        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.blurFBO1.texture)
        this.blurShader.setUniform2f('u_direction', 0.0, 1.0 / bloomHeight)

        this.drawQuad()

        // 6. Composite - disable blending to fully replace framebuffer contents
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        gl.viewport(0, 0, this.width, this.height)
        gl.disable(gl.BLEND)

        this.compositeShader.use()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture)
        this.compositeShader.setUniform1i('u_scene', 0)

        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.blurFBO2.texture)
        this.compositeShader.setUniform1i('u_bloom', 1)

        this.compositeShader.setUniform1f('u_bloomIntensity', this.intensity)

        this.drawQuad()

        gl.enable(gl.BLEND)
        gl.enable(gl.DEPTH_TEST)
    }

    drawQuad() {
        const gl = this.gl
        gl.bindVertexArray(this.quadVAO)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.bindVertexArray(null)
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
        if (this.brightFBO) {
            gl.deleteFramebuffer(this.brightFBO.fbo)
            gl.deleteTexture(this.brightFBO.texture)
        }
        if (this.blurFBO1) {
            gl.deleteFramebuffer(this.blurFBO1.fbo)
            gl.deleteTexture(this.blurFBO1.texture)
        }
        if (this.blurFBO2) {
            gl.deleteFramebuffer(this.blurFBO2.fbo)
            gl.deleteTexture(this.blurFBO2.texture)
        }

        if (this.extractShader) this.extractShader.destroy()
        if (this.blurShader) this.blurShader.destroy()
        if (this.compositeShader) this.compositeShader.destroy()
    }
}
