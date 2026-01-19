import { ShaderProgram } from '../core/ShaderProgram.js'

/**
 * Dual Kawase Bloom Pass
 *
 * Uses the dual filtering technique (SIGGRAPH 2015, Marius Bjørge) for efficient bloom.
 * Instead of multi-pass Gaussian blur, uses a downsample/upsample pyramid:
 *
 * Downsample: Full → 1/2 → 1/4 → 1/8 → 1/16  (5 samples per pixel)
 * Upsample:   1/16 → 1/8 → 1/4 → 1/2 → Full  (8 samples per pixel)
 *
 * This achieves ~40-50% fewer texture samples than traditional Gaussian blur
 * while producing smoother, more natural-looking bloom.
 */
export class BloomPass {
    constructor(gl) {
        this.gl = gl
        this.enabled = false
        this.threshold = 0.6
        this.intensity = 1.4
        this.pyramidLevels = 5  // Number of mip levels in the pyramid

        // Enable float buffer extension for RGBA16F framebuffers
        const ext = gl.getExtension('EXT_color_buffer_float')
        if (!ext) {
            console.warn('EXT_color_buffer_float not supported, bloom may not work correctly')
        }

        this.width = 0
        this.height = 0

        // Shaders
        this.extractShader = null
        this.downsampleShader = null
        this.upsampleShader = null
        this.compositeShader = null

        // Framebuffers
        this.sceneFBO = null      // Full resolution scene render
        this.pyramid = []          // Downsample/upsample pyramid FBOs

        // Fullscreen quad
        this.quadVAO = null
        this.quadVBO = null

        // Output target (null = screen, FBO = another pass)
        this.outputFBO = null

        this.createQuad()
    }

    setOutputFBO(fbo) {
        this.outputFBO = fbo
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

    async loadShaders() {
        const vertPath = 'src/shaders/post/fullscreen.vert.glsl'

        this.extractShader = new ShaderProgram(this.gl)
        await this.extractShader.load(vertPath, 'src/shaders/post/bloom-extract.frag.glsl')

        this.downsampleShader = new ShaderProgram(this.gl)
        await this.downsampleShader.load(vertPath, 'src/shaders/post/kawase-down.frag.glsl')

        this.upsampleShader = new ShaderProgram(this.gl)
        await this.upsampleShader.load(vertPath, 'src/shaders/post/kawase-up.frag.glsl')

        this.compositeShader = new ShaderProgram(this.gl)
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

        for (const level of this.pyramid) {
            gl.deleteFramebuffer(level.fbo)
            gl.deleteTexture(level.texture)
        }
        this.pyramid = []

        // Create scene FBO at full resolution (with depth for card rendering)
        this.sceneFBO = this.createFramebuffer(width, height, true)

        // Create pyramid FBOs - each level is half the previous
        let w = Math.floor(width / 2)
        let h = Math.floor(height / 2)

        for (let i = 0; i < this.pyramidLevels; i++) {
            // Ensure minimum size
            w = Math.max(1, w)
            h = Math.max(1, h)

            this.pyramid.push(this.createFramebuffer(w, h))

            w = Math.floor(w / 2)
            h = Math.floor(h / 2)
        }
    }

    beginSceneRender() {
        if (!this.enabled || !this.sceneFBO) return

        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFBO.fbo)
        gl.viewport(0, 0, this.width, this.height)
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

        // Disable blending so alpha channel is written directly as bloom mask
        // (otherwise SRC_ALPHA blend makes alpha=0 pixels invisible)
        gl.disable(gl.BLEND)
    }

    endSceneRender() {
        if (!this.enabled) return

        const gl = this.gl
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)

        // Restore blending for subsequent passes
        gl.enable(gl.BLEND)
    }

    renderBloom() {
        if (!this.enabled || !this.extractShader || this.pyramid.length === 0) return

        const gl = this.gl

        gl.disable(gl.DEPTH_TEST)
        gl.disable(gl.BLEND)

        // === STEP 1: Extract bright areas into first pyramid level ===
        const firstLevel = this.pyramid[0]
        gl.bindFramebuffer(gl.FRAMEBUFFER, firstLevel.fbo)
        gl.viewport(0, 0, firstLevel.width, firstLevel.height)
        gl.clear(gl.COLOR_BUFFER_BIT)

        this.extractShader.use()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture)
        this.extractShader.setUniform1i('u_texture', 0)
        this.extractShader.setUniform1f('u_threshold', this.threshold)

        this.drawQuad()

        // === STEP 2: Downsample through the pyramid ===
        this.downsampleShader.use()

        for (let i = 1; i < this.pyramid.length; i++) {
            const src = this.pyramid[i - 1]
            const dst = this.pyramid[i]

            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
            gl.viewport(0, 0, dst.width, dst.height)

            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, src.texture)
            this.downsampleShader.setUniform1i('u_texture', 0)
            this.downsampleShader.setUniform2f('u_halfPixel', 0.5 / src.width, 0.5 / src.height)

            this.drawQuad()
        }

        // === STEP 3: Upsample back through the pyramid ===
        // Enable additive blending for upsample passes to accumulate bloom
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE)

        this.upsampleShader.use()

        for (let i = this.pyramid.length - 2; i >= 0; i--) {
            const src = this.pyramid[i + 1]
            const dst = this.pyramid[i]

            gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
            gl.viewport(0, 0, dst.width, dst.height)

            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, src.texture)
            this.upsampleShader.setUniform1i('u_texture', 0)
            this.upsampleShader.setUniform2f('u_halfPixel', 0.5 / src.width, 0.5 / src.height)

            this.drawQuad()
        }

        gl.disable(gl.BLEND)

        // === STEP 4: Composite bloom with original scene ===
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.outputFBO)
        gl.viewport(0, 0, this.width, this.height)

        this.compositeShader.use()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, this.sceneFBO.texture)
        this.compositeShader.setUniform1i('u_scene', 0)

        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.pyramid[0].texture)
        this.compositeShader.setUniform1i('u_bloom', 1)

        this.compositeShader.setUniform1f('u_bloomIntensity', this.intensity)

        this.drawQuad()

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
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

        for (const level of this.pyramid) {
            gl.deleteFramebuffer(level.fbo)
            gl.deleteTexture(level.texture)
        }

        if (this.extractShader) this.extractShader.destroy()
        if (this.downsampleShader) this.downsampleShader.destroy()
        if (this.upsampleShader) this.upsampleShader.destroy()
        if (this.compositeShader) this.compositeShader.destroy()
    }
}
