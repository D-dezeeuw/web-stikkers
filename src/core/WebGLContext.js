export class WebGLContext {
    constructor(canvas) {
        this.canvas = canvas
        this.gl = null
    }

    init() {
        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            alpha: true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true
        })

        if (!this.gl) {
            throw new Error('WebGL 2.0 is not supported in this browser')
        }

        this.configure()
        this.resize()

        // Note: resize listener is handled by CardShaderApp to coordinate with canvas sizing
        return this.gl
    }

    configure() {
        const gl = this.gl

        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LEQUAL)

        gl.clearColor(0, 0, 0, 0)
    }

    resize() {
        const dpr = window.devicePixelRatio || 1
        const displayWidth = Math.floor(this.canvas.clientWidth * dpr)
        const displayHeight = Math.floor(this.canvas.clientHeight * dpr)

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth
            this.canvas.height = displayHeight
            this.gl.viewport(0, 0, displayWidth, displayHeight)
        }
    }

    getAspectRatio() {
        return this.canvas.width / this.canvas.height
    }

    clear() {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
    }
}
