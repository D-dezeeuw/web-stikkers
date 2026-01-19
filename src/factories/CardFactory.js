import { Texture } from '../core/Texture.js'
import { createTextureBrightnessMask } from '../core/MaskFactory.js'

export class CardFactory {
    constructor(gl) {
        this.gl = gl
    }

    async loadCardTextures() {
        const cards = {}

        // Load zelda card
        const zeldaVisual = new Texture(this.gl)
        await zeldaVisual.load('src/textures/zelda/visual.png')
        const zeldaNormal = new Texture(this.gl)
        await zeldaNormal.load('src/textures/zelda/normal.png')
        // Also create brightness mask from zelda visual
        const zeldaBrightness = await this.createBrightnessMaskFromImage('src/textures/zelda/visual.png')
        cards['zelda'] = {
            texture: zeldaVisual,
            normalMap: zeldaNormal,
            brightnessMask: zeldaBrightness
        }

        return cards
    }

    createBrightnessMaskFromImage(url) {
        return new Promise((resolve) => {
            const img = new Image()
            img.crossOrigin = 'anonymous'
            img.onload = () => {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(img, 0, 0)
                resolve(createTextureBrightnessMask(this.gl, canvas))
            }
            img.src = url
        })
    }
}
