/**
 * Test Grid - Demonstrates <sticker-card> web component in a grid layout
 *
 * Uses the lazy loading feature to efficiently display many cards.
 */

import { sticker, registerstickerElement } from './index.js'
import { COMMON_EMOJIS } from './data/emojis.js'

// Register the web component
registerstickerElement()

// Shader list (cycles through for variety)
const SHADERS = sticker.shaderNames

// Helper to pick random item from array
function pickRandom(array) {
    return array[Math.floor(Math.random() * array.length)]
}

/**
 * Overlay manager for expanded card view
 */
class OverlayManager {
    constructor() {
        this.overlay = document.getElementById('overlay')
        this.overlayCard = document.getElementById('overlay-card')
        this.currentsticker = null
        this.isOpen = false

        // Close on overlay click (but not on card click)
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close()
            }
        })
    }

    /**
     * Open overlay with a copy of the card
     * @param {Object} cardConfig - Card configuration
     * @param {stickerElement} sourceElement - Source element to copy content from
     */
    open(cardConfig, sourceElement) {
        if (this.isOpen) return
        this.isOpen = true

        // Show overlay
        this.overlay.classList.add('active')

        // Create sticker element for overlay (not lazy, autoplay)
        const sticker = document.createElement('sticker-card')
        sticker.setAttribute('shader', cardConfig.shader)
        sticker.setAttribute('card-src', cardConfig.cardSrc)
        sticker.setAttribute('card-number', cardConfig.cardNumber)
        if (cardConfig.cardName) {
            sticker.setAttribute('card-name', cardConfig.cardName)
        }
        sticker.setAttribute('interactive', '')

        // Clear and add to overlay
        this.overlayCard.innerHTML = ''
        this.overlayCard.appendChild(sticker)
        this.currentsticker = sticker

        // Copy cached content from source element (for random-emoji/random-geometric)
        // This is done AFTER adding to DOM so sticker instance exists,
        // but BEFORE init completes (due to requestAnimationFrame delay in _initsticker)
        if (sourceElement) {
            sticker.copyContentFrom(sourceElement)
        }
    }

    /**
     * Close overlay and cleanup
     */
    close() {
        if (!this.isOpen) return
        this.isOpen = false

        // Hide overlay
        this.overlay.classList.remove('active')

        // Remove sticker element
        if (this.currentsticker) {
            this.currentsticker.remove()
            this.currentsticker = null
        }
    }
}

/**
 * Create card configuration for a given index
 */
function createCardConfig(index, totalCards) {
    const shaderIndex = index % SHADERS.length
    const shader = SHADERS[shaderIndex]
    const cardNumber = `${String(index + 1).padStart(3, '0')}/${String(totalCards).padStart(3, '0')}`

    // Pick a specific emoji so name matches the image
    const emojiData = pickRandom(COMMON_EMOJIS)
    const cardSrc = `random-emoji:${emojiData.emoji}`
    const cardName = emojiData.name

    return {
        shader,
        cardSrc,
        cardName,
        cardNumber
    }
}

/**
 * Create a sticker element with the given configuration
 */
function createstickerElement(config) {
    const sticker = document.createElement('sticker-card')
    sticker.setAttribute('lazy', '')
    sticker.setAttribute('shader', config.shader)
    sticker.setAttribute('card-src', config.cardSrc)
    sticker.setAttribute('card-number', config.cardNumber)
    if (config.cardName) {
        sticker.setAttribute('card-name', config.cardName)
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
    const totalCards = 380

    // Create all card cells with sticker elements
    for (let i = 0; i < totalCards; i++) {
        const config = createCardConfig(i, totalCards)

        // Create card cell
        const cell = document.createElement('div')
        cell.className = 'card-cell'

        // Create sticker element
        const sticker = createstickerElement(config)
        cell.appendChild(sticker)

        // Add click handler to open overlay
        cell.addEventListener('click', () => {
            overlayManager.open(config, sticker)
        })

        grid.appendChild(cell)
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGrid)
} else {
    initGrid()
}
