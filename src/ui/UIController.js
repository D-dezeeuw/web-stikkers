export class UIController {
    constructor(app) {
        this.app = app
        this.bindElements()
    }

    bindElements() {
        this.cardSelect = document.getElementById('card-select')
        this.shaderSelect = document.getElementById('shader-select')
        this.maskSelect = document.getElementById('mask-select')
        this.hdrToggle = document.getElementById('hdr-toggle')
        this.saturationToggle = document.getElementById('saturation-toggle')
        this.bloomToggle = document.getElementById('bloom-toggle')
        this.showMaskToggle = document.getElementById('show-mask-toggle')
        this.cardTextInput = document.getElementById('card-text')
        this.cardNumberInput = document.getElementById('card-number')
    }

    setupEventListeners() {
        // Card select
        this.cardSelect.addEventListener('change', (e) => this.onCardChange(e))

        // Shader select
        this.shaderSelect.addEventListener('change', (e) => this.onShaderChange(e))

        // Mask select
        this.maskSelect.addEventListener('change', (e) => this.onMaskChange(e))

        // Effect toggles
        this.hdrToggle.addEventListener('change', (e) => {
            this.app.hdrEnabled = e.target.checked
        })

        this.saturationToggle.addEventListener('change', (e) => {
            this.app.saturationBoostEnabled = e.target.checked
        })

        this.bloomToggle.addEventListener('change', (e) => {
            this.app.bloomPass.enabled = e.target.checked
        })

        this.showMaskToggle.addEventListener('change', (e) => {
            this.app.showMask = e.target.checked
        })

        // Text inputs
        this.cardTextInput.addEventListener('input', (e) => {
            this.app.cardText = e.target.value
            this.app.textRenderer.createTextTextures(
                this.app.cardText,
                this.app.cardNumber,
                this.app.card
            )
        })

        this.cardNumberInput.addEventListener('input', (e) => {
            this.app.cardNumber = e.target.value
            this.app.textRenderer.createTextTextures(
                this.app.cardText,
                this.app.cardNumber,
                this.app.card
            )
        })

        // Resize
        window.addEventListener('resize', () => this.onResize())

        // Initial projection setup
        this.app.renderer.updateProjection(this.app.context.getAspectRatio())
    }

    onCardChange(e) {
        const cardData = this.app.cards[e.target.value]
        if (cardData) {
            this.app.card.setTexture('base', cardData.texture)
            // Update mask based on current mask selection
            const maskValue = this.maskSelect.value
            if (maskValue === 'normal-map') {
                const mask = cardData.normalMap || cardData.brightnessMask
                if (mask) this.app.card.setTexture('effectMask', mask)
            } else if (maskValue === 'texture-brightness') {
                if (cardData.brightnessMask) {
                    this.app.card.setTexture('effectMask', cardData.brightnessMask)
                }
            }
        }
    }

    onShaderChange(e) {
        this.app.shaderManager.use(e.target.value)
    }

    onMaskChange(e) {
        // Track if a real mask is active (not "full")
        this.app.maskActive = e.target.value !== 'full'

        const selectedCard = this.cardSelect.value
        const cardData = this.app.cards[selectedCard]

        if (e.target.value === 'normal-map') {
            if (cardData) {
                const mask = cardData.normalMap || cardData.brightnessMask
                if (mask) this.app.card.setTexture('effectMask', mask)
            }
        } else if (e.target.value === 'texture-brightness') {
            if (cardData && cardData.brightnessMask) {
                this.app.card.setTexture('effectMask', cardData.brightnessMask)
            }
        } else {
            const maskTexture = this.app.effectMasks[e.target.value]
            if (maskTexture) {
                this.app.card.setTexture('effectMask', maskTexture)
            }
        }
    }

    onResize() {
        this.app.updateCanvasSize()
        this.app.context.resize()
        this.app.renderer.updateProjection(this.app.context.getAspectRatio())
        this.app.effectsPass.resize(this.app.canvas.width, this.app.canvas.height)
        this.app.bloomPass.resize(this.app.canvas.width, this.app.canvas.height)
        // Update bloom output FBO after resize
        this.app.bloomPass.setOutputFBO(this.app.effectsPass.sceneFBO.fbo)
    }

    // Sync dropdown values with app state
    syncInitialState() {
        this.cardSelect.value = 'zelda'
        this.shaderSelect.value = 'foil'
        this.maskSelect.value = 'normal-map'
    }
}
