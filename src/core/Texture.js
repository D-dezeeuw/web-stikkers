export class Texture {
    constructor(gl) {
        this.gl = gl
        this.texture = null
        this.width = 0
        this.height = 0
    }

    async load(url) {
        return new Promise((resolve, reject) => {
            const image = new Image()
            image.crossOrigin = 'anonymous'

            image.onload = () => {
                this.createFromImage(image)
                resolve(this)
            }

            image.onerror = () => {
                reject(new Error(`Failed to load texture: ${url}`))
            }

            image.src = url
        })
    }

    createFromImage(image, generateMipmaps = false) {
        const gl = this.gl

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        )

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        if (generateMipmaps) {
            gl.generateMipmap(gl.TEXTURE_2D)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        }

        this.width = image.width
        this.height = image.height

        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    createEmpty(width, height, data = null) {
        const gl = this.gl

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        )

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

        this.width = width
        this.height = height

        gl.bindTexture(gl.TEXTURE_2D, null)
    }

    createFromData(width, height, data, options = {}) {
        const gl = this.gl
        const {
            wrapS = gl.CLAMP_TO_EDGE,
            wrapT = gl.CLAMP_TO_EDGE,
            minFilter = gl.LINEAR,
            magFilter = gl.LINEAR
        } = options

        this.texture = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter)
        this.width = width
        this.height = height
        gl.bindTexture(gl.TEXTURE_2D, null)

        return this
    }

    bind(unit = 0) {
        const gl = this.gl
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, this.texture)
    }

    unbind() {
        this.gl.bindTexture(this.gl.TEXTURE_2D, null)
    }

    destroy() {
        if (this.texture) {
            this.gl.deleteTexture(this.texture)
            this.texture = null
        }
    }
}
