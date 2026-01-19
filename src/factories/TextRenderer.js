import { Texture } from '../core/Texture.js'

export class TextRenderer {
    constructor(gl) {
        this.gl = gl
        this.textTexture = null
        this.numberTexture = null
    }

    createTextTextures(cardText, cardNumber, card) {
        // Balanced resolution (2x base resolution)
        const width = 500
        const height = 800

        // Create name texture (for effect mask - shader effects apply to this)
        const nameCanvas = document.createElement('canvas')
        nameCanvas.width = width
        nameCanvas.height = height
        const nameCtx = nameCanvas.getContext('2d')
        nameCtx.clearRect(0, 0, width, height)

        if (cardText && cardText.trim()) {
            nameCtx.fillStyle = '#ffffff'
            nameCtx.textAlign = 'center'
            nameCtx.textBaseline = 'middle'

            // Scale font sizes by 2x for balanced res
            let fontSize = 64
            if (cardText.length > 10) fontSize = 48
            if (cardText.length > 15) fontSize = 40

            nameCtx.font = `bold ${fontSize}px Arial, sans-serif`
            nameCtx.fillText(cardText, width / 2, height * 0.85)
        }

        if (!this.textTexture) {
            this.textTexture = new Texture(this.gl)
        }
        this.textTexture.createFromImage(nameCanvas)
        card.setTexture('text', this.textTexture)

        // Create number texture (overlay only - no shader effects)
        const numberCanvas = document.createElement('canvas')
        numberCanvas.width = width
        numberCanvas.height = height
        const numberCtx = numberCanvas.getContext('2d')
        numberCtx.clearRect(0, 0, width, height)

        if (cardNumber && cardNumber.trim()) {
            numberCtx.fillStyle = '#ffffff'
            numberCtx.textAlign = 'right'
            numberCtx.textBaseline = 'top'
            // Scale font size by 2x for balanced res
            numberCtx.font = 'bold 28px Arial, sans-serif'
            numberCtx.fillText(cardNumber, width * 0.92, height * 0.05)
        }

        if (!this.numberTexture) {
            this.numberTexture = new Texture(this.gl)
        }
        this.numberTexture.createFromImage(numberCanvas)
        card.setTexture('number', this.numberTexture)
    }

    destroy() {
        if (this.textTexture) this.textTexture.destroy()
        if (this.numberTexture) this.numberTexture.destroy()
    }
}
