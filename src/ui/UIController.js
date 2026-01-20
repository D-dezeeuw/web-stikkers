export class UIController {
    constructor(app) {
        this.app = app
        this.bindElements()
    }

    bindElements() {
        this.cardSelect = document.getElementById('card-select')
        this.shaderSelect = document.getElementById('shader-select')
        this.maskSelect = document.getElementById('mask-select')
        this.variantSelect = document.getElementById('variant-select')
        this.bloomSlider = document.getElementById('bloom-slider')
        this.bloomValue = document.getElementById('bloom-value')
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

        // Variant select
        this.variantSelect.addEventListener('change', (e) => this.onVariantChange(e))

        // Bloom slider
        this.bloomSlider.addEventListener('input', (e) => {
            const intensity = parseFloat(e.target.value)
            this.app.bloomPass.enabled = intensity > 0
            this.app.bloomPass.intensity = intensity
            this.bloomValue.textContent = intensity.toFixed(1)
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
        const cardKey = e.target.value
        const cardData = this.app.cards[cardKey]
        if (cardData) {
            this.app.card.setTexture('base', cardData.texture)

            // Default to radial-edge mask for random cards
            const isRandomCard = cardKey === 'random-emoji' || cardKey === 'random-geometric'
            if (isRandomCard) {
                this.maskSelect.value = 'radial-edge'
                this.app.maskActive = true
                this.app.maskType = 'radial-edge'
                this.app.card.setTexture('effectMask', this.app.effectMasks['radial-edge'])
                return
            }

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
        this.app.maskType = e.target.value  // Track mask type for effect scaling

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

    onVariantChange(e) {
        const variant = e.target.value || null
        this.app.setVariant(variant)

        // Update mask dropdown to show border when variant is active
        if (variant) {
            this.maskSelect.value = 'border'
        }
    }

    onResize() {
        this.app.updateCanvasSize()
        this.app.context.resize()
        this.app.renderer.updateProjection(this.app.context.getAspectRatio())
        this.app.bloomPass.resize(this.app.canvas.width, this.app.canvas.height)
    }

    // Sync dropdown values with app state
    syncInitialState() {
        this.cardSelect.value = 'zelda'
        this.shaderSelect.value = 'holographic'
        this.maskSelect.value = 'normal-map'
        this.variantSelect.value = ''
        this.bloomSlider.value = this.app.bloomPass.intensity
        this.bloomValue.textContent = this.app.bloomPass.intensity.toFixed(1)
    }
}
