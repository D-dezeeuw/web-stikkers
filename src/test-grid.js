/**
 * Test Grid - Demonstrates <stikker-card> web component in a grid layout
 *
 * Uses the lazy loading feature to efficiently display many cards.
 */

import { Stikker, registerStikkerElement } from './index.js'
import { COMMON_EMOJIS } from './data/emojis.js'

// Register the web component
registerStikkerElement()

// Shader list (cycles through for variety)
const SHADERS = Stikker.shaderNames

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
        this.currentStikker = null
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
     * @param {StikkerElement} sourceElement - Source element to copy content from
     */
    open(cardConfig, sourceElement) {
        if (this.isOpen) return
        this.isOpen = true

        // Show overlay
        this.overlay.classList.add('active')

        // Create stikker element for overlay (not lazy, autoplay)
        const stikker = document.createElement('stikker-card')
        stikker.setAttribute('shader', cardConfig.shader)
        stikker.setAttribute('card-src', cardConfig.cardSrc)
        stikker.setAttribute('card-number', cardConfig.cardNumber)
        if (cardConfig.cardName) {
            stikker.setAttribute('card-name', cardConfig.cardName)
        }
        stikker.setAttribute('interactive', '')

        // Clear and add to overlay
        this.overlayCard.innerHTML = ''
        this.overlayCard.appendChild(stikker)
        this.currentStikker = stikker

        // Copy cached content from source element (for random-emoji/random-geometric)
        // This is done AFTER adding to DOM so stikker instance exists,
        // but BEFORE init completes (due to requestAnimationFrame delay in _initStikker)
        if (sourceElement) {
            stikker.copyContentFrom(sourceElement)
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

        // Remove stikker element
        if (this.currentStikker) {
            this.currentStikker.remove()
            this.currentStikker = null
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
 * Create a stikker element with the given configuration
 */
function createStikkerElement(config) {
    const stikker = document.createElement('stikker-card')
    stikker.setAttribute('lazy', '')
    stikker.setAttribute('shader', config.shader)
    stikker.setAttribute('card-src', config.cardSrc)
    stikker.setAttribute('card-number', config.cardNumber)
    if (config.cardName) {
        stikker.setAttribute('card-name', config.cardName)
    }
    stikker.setAttribute('interactive', '')
    return stikker
}

/**
 * Initialize the grid
 */
function initGrid() {
    const grid = document.getElementById('grid')
    const overlayManager = new OverlayManager()
    const totalCards = 380

    // Create all card cells with stikker elements
    for (let i = 0; i < totalCards; i++) {
        const config = createCardConfig(i, totalCards)

        // Create card cell
        const cell = document.createElement('div')
        cell.className = 'card-cell'

        // Create stikker element
        const stikker = createStikkerElement(config)
        cell.appendChild(stikker)

        // Add click handler to open overlay
        cell.addEventListener('click', () => {
            overlayManager.open(config, stikker)
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
