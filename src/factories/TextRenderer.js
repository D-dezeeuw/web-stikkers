import { Texture } from '../core/Texture.js'

export class TextRenderer {
    constructor(gl) {
        this.gl = gl
        this.textTexture = null
        this.numberTexture = null
        this.collectionTexture = null

        // Cache for tracking last rendered text values
        this._lastText = null
        this._lastNumber = null
        this._lastCollection = null
    }

    createTextTextures(cardText, cardNumber, cardCollection, card) {
        // Balanced resolution (2x base resolution)
        const width = 500
        const height = 800

        // Normalize empty strings
        const normalizedText = cardText?.trim() || ''
        const normalizedNumber = cardNumber?.trim() || ''
        const normalizedCollection = cardCollection?.trim() || ''

        // Only update textures that have changed
        const textChanged = this._lastText !== normalizedText
        const numberChanged = this._lastNumber !== normalizedNumber
        const collectionChanged = this._lastCollection !== normalizedCollection

        // Create name texture (for effect mask - shader effects apply to this)
        if (textChanged) {
            const nameCanvas = document.createElement('canvas')
            nameCanvas.width = width
            nameCanvas.height = height
            const nameCtx = nameCanvas.getContext('2d')
            nameCtx.clearRect(0, 0, width, height)

            if (normalizedText) {
                nameCtx.fillStyle = '#ffffff'
                nameCtx.textAlign = 'center'
                nameCtx.textBaseline = 'middle'

                // Scale font sizes by 2x for balanced res
                let fontSize = 64
                if (normalizedText.length > 10) fontSize = 48
                if (normalizedText.length > 15) fontSize = 40

                nameCtx.font = `bold ${fontSize}px Arial, sans-serif`
                nameCtx.fillText(normalizedText, width / 2, height * 0.85)
            }

            if (!this.textTexture) {
                this.textTexture = new Texture(this.gl)
            }
            this.textTexture.createFromImage(nameCanvas, false)
            this._lastText = normalizedText
        }
        card.setTexture('text', this.textTexture)

        // Create number texture (overlay only - no shader effects)
        if (numberChanged) {
            const numberCanvas = document.createElement('canvas')
            numberCanvas.width = width
            numberCanvas.height = height
            const numberCtx = numberCanvas.getContext('2d')
            numberCtx.clearRect(0, 0, width, height)

            if (normalizedNumber) {
                numberCtx.fillStyle = '#ffffff'
                numberCtx.textAlign = 'right'
                numberCtx.textBaseline = 'top'
                // Scale font size by 2x for balanced res
                numberCtx.font = 'bold 28px Arial, sans-serif'
                numberCtx.fillText(normalizedNumber, width * 0.92, height * 0.05)
            }

            if (!this.numberTexture) {
                this.numberTexture = new Texture(this.gl)
            }
            this.numberTexture.createFromImage(numberCanvas, false)
            this._lastNumber = normalizedNumber
        }
        card.setTexture('number', this.numberTexture)

        // Create collection texture (top left - overlay only)
        if (collectionChanged) {
            const collectionCanvas = document.createElement('canvas')
            collectionCanvas.width = width
            collectionCanvas.height = height
            const collectionCtx = collectionCanvas.getContext('2d')
            collectionCtx.clearRect(0, 0, width, height)

            if (normalizedCollection) {
                collectionCtx.fillStyle = '#ffffff'
                collectionCtx.textAlign = 'left'
                collectionCtx.textBaseline = 'top'
                // Scale font size by 2x for balanced res
                collectionCtx.font = 'bold 28px Arial, sans-serif'
                collectionCtx.fillText(normalizedCollection, width * 0.04, height * 0.05)
            }

            if (!this.collectionTexture) {
                this.collectionTexture = new Texture(this.gl)
            }
            this.collectionTexture.createFromImage(collectionCanvas, false)
            this._lastCollection = normalizedCollection
        }
        card.setTexture('collection', this.collectionTexture)
    }

    destroy() {
        if (this.textTexture) this.textTexture.destroy()
        if (this.numberTexture) this.numberTexture.destroy()
        if (this.collectionTexture) this.collectionTexture.destroy()
    }
}
