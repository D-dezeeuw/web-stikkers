/**
 * Variant Demo - Shows all shader effects with all parallel variants
 *
 * Grid layout:
 * - Rows: shader effects (holographic, foil, etc.)
 * - Columns: variants (none, blue, red, purple, green, gold, black)
 * - Card: Zelda
 */

import { sticker, registerstickerElement } from './index.js'

// Register the web component
registerstickerElement()

// Shader list (skip 'base' as it doesn't show effects well)
const SHADERS = sticker.shaderNames.filter(s => s !== 'base')

// Variant list (null = no variant, then all colors)
const VARIANTS = [null, 'blue', 'red', 'purple', 'green', 'gold', 'black']

// Card source
const CARD_SRC = 'src/textures/zelda/visual.png'
const CARD_NORMAL = 'src/textures/zelda/normal.png'
const CARD_NAME = 'Link'
const CARD_NUMBER = '001/321'

/**
 * Overlay manager for expanded card view
 */
class OverlayManager {
    constructor() {
        this.overlay = document.getElementById('overlay')
        this.overlayCard = document.getElementById('overlay-card')
        this.overlayLabel = document.getElementById('overlay-label')
        this.currentSticker = null
        this.isOpen = false

        // Close on overlay click (but not on card click)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close()
            }
        })

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close()
            }
        })
    }

    open(config) {
        if (this.isOpen) return
        this.isOpen = true

        this.overlay.classList.add('active')

        // Create sticker element for overlay
        const sticker = document.createElement('sticker-card')
        sticker.setAttribute('size', 'xxl')
        sticker.setAttribute('shader', config.shader)
        sticker.setAttribute('card-src', config.cardSrc)
        sticker.setAttribute('card-normal', config.cardNormal)
        sticker.setAttribute('card-name', config.cardName)
        sticker.setAttribute('card-number', config.cardNumber)
        sticker.setAttribute('mask', config.mask)
        if (config.variant) {
            sticker.setAttribute('variant', config.variant)
        }
        sticker.setAttribute('interactive', '')

        this.overlayCard.innerHTML = ''
        this.overlayCard.appendChild(sticker)
        this.currentSticker = sticker

        // Update label
        const variantLabel = config.variant ? `${config.variant} parallel` : 'base'
        this.overlayLabel.textContent = `${config.shader} - ${variantLabel}`
    }

    close() {
        if (!this.isOpen) return
        this.isOpen = false

        this.overlay.classList.remove('active')

        if (this.currentSticker) {
            this.currentSticker.remove()
            this.currentSticker = null
        }
    }
}

/**
 * Create a sticker element with the given configuration
 */
function createStickerElement(config) {
    const sticker = document.createElement('sticker-card')
    sticker.setAttribute('size', 's')
    sticker.setAttribute('lazy', '')
    sticker.setAttribute('shader', config.shader)
    sticker.setAttribute('card-src', config.cardSrc)
    sticker.setAttribute('card-normal', config.cardNormal)
    sticker.setAttribute('card-name', config.cardName)
    sticker.setAttribute('card-number', config.cardNumber)
    sticker.setAttribute('mask', config.mask)
    if (config.variant) {
        sticker.setAttribute('variant', config.variant)
    }
    sticker.setAttribute('interactive', '')
    return sticker
}

/**
 * Initialize the grid
 */
function initGrid() {
    const grid = document.getElementById('grid')
    const overlayManager = new OverlayManager()

    // Create rows for each shader
    for (const shader of SHADERS) {
        const row = document.createElement('div')
        row.className = 'shader-row'

        // Shader label
        const label = document.createElement('div')
        label.className = 'shader-label'
        label.textContent = shader.replace('-', ' ')
        row.appendChild(label)

        // Create card for each variant
        for (const variant of VARIANTS) {
            const config = {
                shader,
                cardSrc: CARD_SRC,
                cardNormal: CARD_NORMAL,
                cardName: CARD_NAME,
                cardNumber: CARD_NUMBER,
                mask: variant ? 'border' : 'normal',  // Use border mask for variants
                variant
            }

            const cell = document.createElement('div')
            cell.className = 'card-cell'

            const sticker = createStickerElement(config)
            cell.appendChild(sticker)

            // Click to open overlay
            cell.addEventListener('click', () => {
                overlayManager.open(config)
            })

            row.appendChild(cell)
        }

        grid.appendChild(row)
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrid)
} else {
    initGrid()
}
