/**
 * TextureLoader - Helper for loading textures from various sources
 *
 * Supports:
 * - URL strings (fetches image)
 * - HTMLImageElement (direct use)
 * - HTMLCanvasElement (direct use)
 * - ImageData (creates from data)
 */

import { Texture } from '../core/Texture.js'

export class TextureLoader {
    constructor(gl) {
        this.gl = gl
    }

    /**
     * Load a texture from various source types
     * @param {string|HTMLImageElement|HTMLCanvasElement|ImageData} source
     * @returns {Promise<Texture>}
     */
    async load(source) {
        const texture = new Texture(this.gl)

        if (typeof source === 'string') {
            // URL string - load image
            await texture.load(source)
        } else if (source instanceof HTMLImageElement) {
            // Image element
            if (source.complete && source.naturalWidth > 0) {
                texture.createFromImage(source)
            } else {
                await this.waitForImageLoad(source)
                texture.createFromImage(source)
            }
        } else if (source instanceof HTMLCanvasElement) {
            // Canvas element - use directly
            texture.createFromImage(source)
        } else if (source instanceof ImageData) {
            // ImageData - create from data
            texture.createFromData(
                source.width,
                source.height,
                new Uint8Array(source.data.buffer)
            )
        } else {
            throw new Error('Unsupported texture source type')
        }

        return texture
    }

    /**
     * Wait for an image element to load
     * @param {HTMLImageElement} image
     * @returns {Promise<void>}
     */
    waitForImageLoad(image) {
        return new Promise((resolve, reject) => {
            if (image.complete && image.naturalWidth > 0) {
                resolve()
                return
            }

            const onLoad = () => {
                cleanup()
                resolve()
            }

            const onError = () => {
                cleanup()
                reject(new Error('Image failed to load'))
            }

            const cleanup = () => {
                image.removeEventListener('load', onLoad)
                image.removeEventListener('error', onError)
            }

            image.addEventListener('load', onLoad)
            image.addEventListener('error', onError)
        })
    }

    /**
     * Create a texture from a canvas drawing function
     * @param {number} width
     * @param {number} height
     * @param {Function} drawFn - Function that receives (ctx, width, height)
     * @returns {Texture}
     */
    createFromCanvas(width, height, drawFn) {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        drawFn(ctx, width, height)

        const texture = new Texture(this.gl)
        texture.createFromImage(canvas)
        return texture
    }

    /**
     * Create an empty texture
     * @param {number} width
     * @param {number} height
     * @returns {Texture}
     */
    createEmpty(width, height) {
        const texture = new Texture(this.gl)
        texture.createEmpty(width, height)
        return texture
    }
}
