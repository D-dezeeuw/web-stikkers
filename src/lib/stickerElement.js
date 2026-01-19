/**
 * stickerElement - Web Component wrapper for sticker
 *
 * Usage:
 *   <sticker shader="holographic" card-src="zelda" card-name="Link"></sticker>
 */

import { sticker } from './sticker.js'
import { WebGLContextPool } from './WebGLContextPool.js'

// Global render queue to prevent WebGL context exhaustion
// Only one card renders its static frame at a time
const renderQueue = []
let isProcessingQueue = false
let processDebounceTimer = null

async function enqueueStaticRender(element) {
    return new Promise((resolve) => {
        renderQueue.push({ element, resolve })
        scheduleProcessing()
    })
}

function scheduleProcessing() {
    // Process on next microtask - allows same-frame batching without delay
    if (processDebounceTimer) return  // Already scheduled
    processDebounceTimer = true
    queueMicrotask(() => {
        processDebounceTimer = null
        processRenderQueue()
    })
}

async function processRenderQueue() {
    if (isProcessingQueue || renderQueue.length === 0) return

    isProcessingQueue = true

    // Pre-compute bounding rects once (avoid repeated DOM queries during sort)
    for (const item of renderQueue) {
        item.rect = item.element.getBoundingClientRect()
    }

    // Sort queue by DOM position (top to bottom, left to right)
    renderQueue.sort((a, b) => {
        // Primary sort by vertical position, secondary by horizontal
        if (Math.abs(a.rect.top - b.rect.top) > 10) {
            return a.rect.top - b.rect.top
        }
        return a.rect.left - b.rect.left
    })

    while (renderQueue.length > 0) {
        const { element, resolve } = renderQueue.shift()
        try {
            await element._doRenderStaticFrame()
        } catch (err) {
            console.error('Failed to render static frame:', err)
        }
        resolve()
    }

    isProcessingQueue = false
}

/**
 * Remove an element from the render queue (e.g., when disconnected before rendering)
 * @param {stickerElement} element
 */
function removeFromRenderQueue(element) {
    const index = renderQueue.findIndex(item => item.element === element)
    if (index !== -1) {
        const { resolve } = renderQueue[index]
        renderQueue.splice(index, 1)
        resolve() // Resolve the promise to prevent hanging
    }
}

const TEMPLATE = `
<style>
    :host {
        display: block;
        position: relative;
        aspect-ratio: 5 / 8;
    }
    .container {
        width: 100%;
        height: 100%;
        position: relative;
    }
    canvas, img {
        width: 100%;
        height: 100%;
        display: block;
    }
    img {
        position: absolute;
        top: 0;
        left: 0;
        object-fit: contain;
    }
</style>
<div class="container">
    <canvas></canvas>
    <img style="display: none;">
</div>
`

// Attribute to option name mapping
const ATTR_TO_OPTION = {
    'shader': 'shader',
    'card-src': 'cardSrc',
    'card-normal': 'cardNormal',
    'card-name': 'cardName',
    'card-number': 'cardNumber',
    'mask': 'mask',
    'bloom': 'bloom',
    'interactive': 'interactive',
    'lazy': 'lazy',
    'autoplay': 'autoplay'
}

// Attributes that don't map to sticker options (handled separately)
const ELEMENT_ONLY_ATTRS = ['lazy-margin']

// Boolean attributes
const BOOLEAN_ATTRS = ['bloom', 'interactive', 'lazy', 'autoplay']

// Default margin for viewport intersection (pixels)
const DEFAULT_LAZY_MARGIN = 200

export class stickerElement extends HTMLElement {
    static observedAttributes = [...Object.keys(ATTR_TO_OPTION), ...ELEMENT_ONLY_ATTRS]

    constructor() {
        super()
        this.sticker = null
        this._initialized = false
        this._isLazy = false

        // Intersection Observer state for viewport-based lazy loading
        this._intersectionObserver = null
        this._hasRenderedStaticFrame = false
        this._isIntersecting = false

        // Bound event handlers for lazy mode (must be stored to allow removal)
        this._boundActivate = () => this._onMouseEnter()
        this._boundDeactivate = () => this._onMouseLeave()

        // Ready state for blocking rapid hover events
        this._isReady = true
        this._mouseIsOver = false
    }

    connectedCallback() {
        // Create shadow DOM
        this.attachShadow({ mode: 'open' })
        this.shadowRoot.innerHTML = TEMPLATE

        // Get canvas and image elements
        this._canvas = this.shadowRoot.querySelector('canvas')
        this._staticImage = this.shadowRoot.querySelector('img')

        // Parse options from attributes
        const options = this._getOptionsFromAttributes()

        // Create sticker instance
        this.sticker = new sticker(this._canvas, options)

        // Wire up error callback to dispatch events
        this.sticker.onError = (err) => {
            this.dispatchEvent(new CustomEvent('sticker:error', {
                bubbles: true,
                composed: true,
                detail: { error: err }
            }))
        }

        // Wire up source loaded callback to dispatch events (for generated names etc)
        this.sticker.onSourceLoaded = () => {
            this.dispatchEvent(new CustomEvent('sticker:source-loaded', {
                bubbles: true,
                composed: true,
                detail: { generatedName: this.sticker.generatedName }
            }))
        }

        // Wire up static image for lazy mode
        if (options.lazy) {
            this.sticker.staticImage = this._staticImage
            this._setupLazyMode()
        } else {
            // Initialize immediately
            this._initsticker()
        }

        this._initialized = true
    }

    disconnectedCallback() {
        // Disconnect Intersection Observer
        if (this._intersectionObserver) {
            this._intersectionObserver.disconnect()
            this._intersectionObserver = null
        }

        // Remove from render queue if pending
        removeFromRenderQueue(this)

        // Remove lazy mode event listeners BEFORE destroying sticker
        // This is critical to prevent context leaks
        if (this._isLazy) {
            this.removeEventListener('mouseenter', this._boundActivate)
            this.removeEventListener('mouseleave', this._boundDeactivate)
        }

        // Cancel any pending borrow requests from the pool
        const pool = WebGLContextPool.getInstance()
        pool.cancelRequest(this.sticker)

        // destroy() handles releasing the borrowed context back to the pool
        this.sticker?.destroy()
        this.sticker = null
        this._initialized = false
        this._isLazy = false
        this._hasRenderedStaticFrame = false
        this._isIntersecting = false
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal) return
        if (!this._initialized || !this.sticker) return

        const optionName = ATTR_TO_OPTION[name]
        if (!optionName) return

        const value = this._parseAttributeValue(name, newVal)
        this.sticker.setOptions({ [optionName]: value })
    }

    /**
     * Initialize the sticker (non-lazy mode)
     */
    async _initsticker() {
        // Wait for layout to be computed
        await new Promise(resolve => requestAnimationFrame(resolve))

        try {
            await this.sticker.init()

            if (this._getAttrBool('autoplay', true)) {
                this.sticker.start()
            }

            // Activate if mouse is already over element (e.g., overlay scenarios)
            if (this.matches(':hover')) {
                this.sticker.isActive = true
            }

            this.dispatchEvent(new CustomEvent('sticker:ready', {
                bubbles: true,
                composed: true
            }))
        } catch (err) {
            console.error('Failed to initialize sticker:', err)
            this.dispatchEvent(new CustomEvent('sticker:error', {
                bubbles: true,
                composed: true,
                detail: { error: err }
            }))
        }
    }

    /**
     * Setup lazy mode with viewport-based static frame rendering and hover activation
     */
    _setupLazyMode() {
        this._isLazy = true

        // Setup hover listeners (using bound handlers so they can be removed later)
        this.addEventListener('mouseenter', this._boundActivate)
        this.addEventListener('mouseleave', this._boundDeactivate)

        // Track if mouse is already over element (e.g., overlay scenarios)
        if (this.matches(':hover')) {
            this._mouseIsOver = true
        }

        // Setup Intersection Observer for viewport-based static frame rendering
        this._setupIntersectionObserver()
    }

    /**
     * Setup Intersection Observer to defer static frame rendering until near viewport
     */
    _setupIntersectionObserver() {
        // Get margin from attribute or use default
        const margin = this._getLazyMargin()

        // Create observer that triggers when element is near viewport
        this._intersectionObserver = new IntersectionObserver(
            (entries) => this._onIntersection(entries),
            {
                // rootMargin extends the viewport bounds for earlier triggering
                rootMargin: `${margin}px`,
                // threshold 0 means trigger as soon as even 1 pixel is visible
                threshold: 0
            }
        )

        // Start observing this element
        this._intersectionObserver.observe(this)
    }

    /**
     * Handle intersection changes
     * @param {IntersectionObserverEntry[]} entries
     */
    _onIntersection(entries) {
        const entry = entries[0]
        this._isIntersecting = entry.isIntersecting

        // If entering viewport and haven't rendered static frame yet, do so now
        if (entry.isIntersecting && !this._hasRenderedStaticFrame) {
            this._hasRenderedStaticFrame = true
            this._renderStaticFrame()

            // Unobserve after triggering - static frame only needs to render once
            this._intersectionObserver?.unobserve(this)
        }
    }

    /**
     * Get the lazy-margin value (pixels before viewport to start rendering)
     * @returns {number}
     */
    _getLazyMargin() {
        if (this.hasAttribute('lazy-margin')) {
            const value = parseInt(this.getAttribute('lazy-margin'), 10)
            return isNaN(value) ? DEFAULT_LAZY_MARGIN : value
        }
        return DEFAULT_LAZY_MARGIN
    }

    /**
     * Render static frame for lazy mode (queued to prevent context exhaustion)
     */
    async _renderStaticFrame() {
        // Block hover events immediately (before debounce delay)
        this._isReady = false
        try {
            // Enqueue this render - only one card renders at a time
            await enqueueStaticRender(this)
        } finally {
            this._isReady = true
            // Reconcile: if mouse is hovering, activate now
            if (this._mouseIsOver && !this.sticker.isActive) {
                this._activate()
            }
        }
    }

    /**
     * Actually render the static frame (called by queue processor)
     */
    async _doRenderStaticFrame() {
        // Wait for layout to be computed
        await new Promise(resolve => requestAnimationFrame(resolve))
        await this.sticker.renderStaticFrame()
    }

    /**
     * Handle mouseenter - track mouse state and activate if ready
     */
    _onMouseEnter() {
        this._mouseIsOver = true
        if (this._isReady) {
            this._activate()
        }
    }

    /**
     * Handle mouseleave - track mouse state and deactivate if ready
     */
    _onMouseLeave() {
        this._mouseIsOver = false
        if (this._isReady) {
            this._deactivate()
        }
    }

    /**
     * Activate (lazy mode)
     */
    async _activate() {
        if (!this.sticker) return

        this._isReady = false
        try {
            await this.sticker.activate()
        } finally {
            this._isReady = true
            // Reconcile: if mouse left while activating, deactivate now
            if (!this._mouseIsOver && this.sticker.isActive) {
                this._deactivate()
            }
        }
    }

    /**
     * Deactivate (lazy mode)
     */
    _deactivate() {
        if (!this.sticker) return
        this.sticker.deactivate()
    }

    /**
     * Get options object from current attributes
     */
    _getOptionsFromAttributes() {
        const options = {}

        for (const [attr, option] of Object.entries(ATTR_TO_OPTION)) {
            if (this.hasAttribute(attr)) {
                options[option] = this._parseAttributeValue(attr, this.getAttribute(attr))
            }
        }

        return options
    }

    /**
     * Parse attribute value to appropriate type
     */
    _parseAttributeValue(name, value) {
        if (BOOLEAN_ATTRS.includes(name)) {
            // Boolean: present = true, absent = false, "false" = false
            if (value === null) return false
            if (value === 'false') return false
            return true
        }
        return value
    }

    /**
     * Get boolean attribute with default
     */
    _getAttrBool(name, defaultValue = false) {
        if (!this.hasAttribute(name)) return defaultValue
        const value = this.getAttribute(name)
        if (value === 'false') return false
        return true
    }

    // ==================== Public API ====================

    /**
     * Get the underlying sticker instance
     */
    get instance() {
        return this.sticker
    }

    /**
     * Start rendering
     */
    start() {
        this.sticker?.start()
    }

    /**
     * Stop rendering
     */
    stop() {
        this.sticker?.stop()
    }

    /**
     * Set shader effect
     */
    setShader(name) {
        this.sticker?.setShader(name)
    }

    /**
     * Set card image source
     */
    setCardSrc(src) {
        this.sticker?.setCardSrc(src)
    }

    /**
     * Set card name text
     */
    setCardName(name) {
        this.sticker?.setCardName(name)
    }

    /**
     * Set card number text
     */
    setCardNumber(number) {
        this.sticker?.setCardNumber(number)
    }

    /**
     * Set effect mask
     */
    setMask(mask) {
        this.sticker?.setMask(mask)
    }

    /**
     * Set multiple options
     */
    setOptions(options) {
        this.sticker?.setOptions(options)
    }

    /**
     * Copy content from another stickerElement (for overlay/clone use)
     * This allows generated content (random-emoji, random-geometric) to be
     * preserved when creating a copy of a card (e.g., for overlay display).
     * No data leaks externally - this is internal component communication.
     * @param {stickerElement} sourceElement - The source element to copy from
     */
    copyContentFrom(sourceElement) {
        if (sourceElement?.sticker && this.sticker) {
            this.sticker._copyContentFrom(sourceElement.sticker)
        }
    }

    /**
     * Check if the card is currently intersecting with the viewport
     * @returns {boolean}
     */
    get isInViewport() {
        return this._isIntersecting
    }

    /**
     * Check if the static frame has been rendered
     * @returns {boolean}
     */
    get hasRenderedStaticFrame() {
        return this._hasRenderedStaticFrame
    }

    /**
     * Get the generated name (for random-emoji or random-geometric content)
     * @returns {string|null}
     */
    get generatedName() {
        return this.sticker?.generatedName || null
    }

    /**
     * Force render the static frame immediately (bypasses Intersection Observer)
     * Useful when the app knows the card is about to become visible.
     * No-op if static frame has already been rendered.
     */
    renderStaticFrame() {
        if (this._hasRenderedStaticFrame || !this._isLazy) return

        this._hasRenderedStaticFrame = true

        // Stop observing since we're rendering manually
        if (this._intersectionObserver) {
            this._intersectionObserver.unobserve(this)
        }

        this._renderStaticFrame()
    }

    // ==================== Static ====================

    /**
     * Available shader names
     */
    static get shaderNames() {
        return sticker.shaderNames
    }

    /**
     * Available mask names
     */
    static get maskNames() {
        return sticker.maskNames
    }

    /**
     * Built-in card sources
     */
    static get builtinSources() {
        return sticker.builtinSources
    }
}

// Register the custom element
export function registerstickerElement(tagName = 'sticker-card') {
    if (!customElements.get(tagName)) {
        customElements.define(tagName, stickerElement)
    }
}

// Auto-register if not in a module context that might want to customize
if (typeof window !== 'undefined' && !window.__sticker_NO_AUTO_REGISTER__) {
    registerstickerElement()
}
