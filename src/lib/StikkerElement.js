/**
 * StikkerElement - Web Component wrapper for Stikker
 *
 * Usage:
 *   <stikker shader="holographic" card-src="zelda" card-name="Link"></stikker>
 */

import { Stikker } from './Stikker.js'
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
 * @param {StikkerElement} element
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
    'card-name': 'cardName',
    'card-number': 'cardNumber',
    'mask': 'mask',
    'bloom': 'bloom',
    'hdr': 'hdr',
    'saturation': 'saturation',
    'interactive': 'interactive',
    'lazy': 'lazy',
    'autoplay': 'autoplay'
}

// Attributes that don't map to Stikker options (handled separately)
const ELEMENT_ONLY_ATTRS = ['lazy-margin']

// Boolean attributes
const BOOLEAN_ATTRS = ['bloom', 'hdr', 'saturation', 'interactive', 'lazy', 'autoplay']

// Default margin for viewport intersection (pixels)
const DEFAULT_LAZY_MARGIN = 200

export class StikkerElement extends HTMLElement {
    static observedAttributes = [...Object.keys(ATTR_TO_OPTION), ...ELEMENT_ONLY_ATTRS]

    constructor() {
        super()
        this.stikker = null
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

        // Create Stikker instance
        this.stikker = new Stikker(this._canvas, options)

        // Wire up static image for lazy mode
        if (options.lazy) {
            this.stikker.staticImage = this._staticImage
            this._setupLazyMode()
        } else {
            // Initialize immediately
            this._initStikker()
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

        // Remove lazy mode event listeners BEFORE destroying stikker
        // This is critical to prevent context leaks
        if (this._isLazy) {
            this.removeEventListener('mouseenter', this._boundActivate)
            this.removeEventListener('mouseleave', this._boundDeactivate)
        }

        // Cancel any pending borrow requests from the pool
        const pool = WebGLContextPool.getInstance()
        pool.cancelRequest(this.stikker)

        // destroy() handles releasing the borrowed context back to the pool
        this.stikker?.destroy()
        this.stikker = null
        this._initialized = false
        this._isLazy = false
        this._hasRenderedStaticFrame = false
        this._isIntersecting = false
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal) return
        if (!this._initialized || !this.stikker) return

        const optionName = ATTR_TO_OPTION[name]
        if (!optionName) return

        const value = this._parseAttributeValue(name, newVal)
        this.stikker.setOptions({ [optionName]: value })
    }

    /**
     * Initialize the Stikker (non-lazy mode)
     */
    async _initStikker() {
        // Wait for layout to be computed
        await new Promise(resolve => requestAnimationFrame(resolve))

        try {
            await this.stikker.init()

            if (this._getAttrBool('autoplay', true)) {
                this.stikker.start()
            }

            this.dispatchEvent(new CustomEvent('stikker:ready', {
                bubbles: true,
                composed: true
            }))
        } catch (err) {
            console.error('Failed to initialize Stikker:', err)
            this.dispatchEvent(new CustomEvent('stikker:error', {
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
            if (this._mouseIsOver && !this.stikker.isActive) {
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
        await this.stikker.renderStaticFrame()
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
        if (!this.stikker) return

        this._isReady = false
        try {
            await this.stikker.activate()
        } finally {
            this._isReady = true
            // Reconcile: if mouse left while activating, deactivate now
            if (!this._mouseIsOver && this.stikker.isActive) {
                this._deactivate()
            }
        }
    }

    /**
     * Deactivate (lazy mode)
     */
    _deactivate() {
        if (!this.stikker) return
        this.stikker.deactivate()
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
     * Get the underlying Stikker instance
     */
    get instance() {
        return this.stikker
    }

    /**
     * Start rendering
     */
    start() {
        this.stikker?.start()
    }

    /**
     * Stop rendering
     */
    stop() {
        this.stikker?.stop()
    }

    /**
     * Set shader effect
     */
    setShader(name) {
        this.stikker?.setShader(name)
    }

    /**
     * Set card image source
     */
    setCardSrc(src) {
        this.stikker?.setCardSrc(src)
    }

    /**
     * Set card name text
     */
    setCardName(name) {
        this.stikker?.setCardName(name)
    }

    /**
     * Set card number text
     */
    setCardNumber(number) {
        this.stikker?.setCardNumber(number)
    }

    /**
     * Set effect mask
     */
    setMask(mask) {
        this.stikker?.setMask(mask)
    }

    /**
     * Set multiple options
     */
    setOptions(options) {
        this.stikker?.setOptions(options)
    }

    /**
     * Copy content from another StikkerElement (for overlay/clone use)
     * This allows generated content (random-emoji, random-geometric) to be
     * preserved when creating a copy of a card (e.g., for overlay display).
     * No data leaks externally - this is internal component communication.
     * @param {StikkerElement} sourceElement - The source element to copy from
     */
    copyContentFrom(sourceElement) {
        if (sourceElement?.stikker && this.stikker) {
            this.stikker._copyContentFrom(sourceElement.stikker)
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
        return Stikker.shaderNames
    }

    /**
     * Available mask names
     */
    static get maskNames() {
        return Stikker.maskNames
    }

    /**
     * Built-in card sources
     */
    static get builtinSources() {
        return Stikker.builtinSources
    }
}

// Register the custom element
export function registerStikkerElement(tagName = 'stikker-card') {
    if (!customElements.get(tagName)) {
        customElements.define(tagName, StikkerElement)
    }
}

// Auto-register if not in a module context that might want to customize
if (typeof window !== 'undefined' && !window.__STIKKER_NO_AUTO_REGISTER__) {
    registerStikkerElement()
}
