/**
 * ShaderButtonElement - Web component for shader-enhanced buttons
 *
 * Usage:
 *   <shader-button shader="holographic" mode="border" variant="blue">
 *     Click Me
 *   </shader-button>
 */

import { ShaderButton } from './shaderButton.js'

// Shadow DOM template
const TEMPLATE = document.createElement('template')
TEMPLATE.innerHTML = `
<style>
:host {
    --border-width: 3px;
    --border-radius: 8px;
    --bg-color: #1a1a2e;
    display: inline-flex;
    position: relative;
    cursor: pointer;
    border-radius: var(--border-radius);
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
}

:host([disabled]) {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}

canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    border-radius: inherit;
    z-index: 0;
}

.content {
    position: relative;
    z-index: 1;
    padding: 12px 24px;
    color: white;
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

/* Border mode: solid background on content, shader shows as border */
:host([mode="border"]) .content {
    flex: 1;
    margin: var(--border-width);
    background: var(--bg-color);
    border-radius: calc(var(--border-radius) - var(--border-width));
}


/* Size variants */
:host([size="small"]) .content,
:host([size="small"]) .overlay-text {
    padding: 8px 16px;
    font-size: 0.875rem;
}

:host([size="large"]) .content,
:host([size="large"]) .overlay-text {
    padding: 16px 32px;
    font-size: 1.125rem;
    display: block;
}

/* Pressed state */
:host(:active) {
    transform: scale(0.98);
}

/* Focus state */
:host(:focus-visible) {
    outline: 2px solid rgba(255, 255, 255, 0.5);
    outline-offset: 2px;
}

/* Text mask mode: overlay with black text, SVG filter punches holes */
.overlay {
    display: none;
    position: absolute;
    inset: 0;
    background: var(--bg-color);
    border-radius: inherit;
    z-index: 2;
    filter: url(#remove-black);
    margin: var(--overlay-margin, 0);
    font-size: var(--overlay-font-size, inherit);
}

.overlay-text {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-family: inherit;
    font-size: inherit;
    font-weight: 600;
    color: black;
    margin: 0;
}

:host([text-mask]) .overlay {
    display: block;
}

:host([text-mask]) .content {
    visibility: hidden;
}

</style>
<svg width="0" height="0" style="position:absolute">
    <filter id="remove-black" color-interpolation-filters="sRGB">
        <feColorMatrix type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    10 10 10 0 0" />
    </filter>
</svg>
<canvas></canvas>
<div class="overlay">
    <p class="overlay-text"></p>
</div>
<div class="content"><slot></slot></div>
`

// Attribute to option mapping
const ATTR_TO_OPTION = {
    'shader': 'shader',
    'mode': 'mode',
    'variant': 'variant',
    'border-width': 'borderWidth',
    'intensity': 'intensity',
    'resting-tilt': 'restingTilt',
    'resting-focus': 'restingFocus'
}

class ShaderButtonElement extends HTMLElement {
    static get observedAttributes() {
        return ['shader', 'mode', 'variant', 'disabled', 'border-width', 'intensity', 'size', 'resting-tilt', 'resting-focus', 'animate', 'text-mask']
    }

    constructor() {
        super()

        this.attachShadow({ mode: 'open' })
        this.shadowRoot.appendChild(TEMPLATE.content.cloneNode(true))

        this._canvas = this.shadowRoot.querySelector('canvas')
        this._content = this.shadowRoot.querySelector('.content')
        this._slot = this.shadowRoot.querySelector('slot')
        this._overlay = this.shadowRoot.querySelector('.overlay')
        this._overlayText = this.shadowRoot.querySelector('.overlay-text')
        this._button = null
        this._isConnected = false
        this._resizeObserver = null

        // Bound event handlers
        this._onMouseEnter = this._onMouseEnter.bind(this)
        this._onMouseLeave = this._onMouseLeave.bind(this)
        this._onMouseMove = this._onMouseMove.bind(this)
        this._onClick = this._onClick.bind(this)
        this._onKeyDown = this._onKeyDown.bind(this)
        this._onSlotChange = this._onSlotChange.bind(this)
    }

    connectedCallback() {
        this._isConnected = true

        // Make focusable
        if (!this.hasAttribute('tabindex')) {
            this.setAttribute('tabindex', '0')
        }

        // Set role for accessibility
        if (!this.hasAttribute('role')) {
            this.setAttribute('role', 'button')
        }

        // Parse initial options from attributes
        const options = this._parseAttributes()

        // Always use 'background' mode for shader - border effect is handled via CSS
        options.mode = 'background'

        // Create ShaderButton instance
        this._button = new ShaderButton(this._canvas, options)

        // Initialize and start
        this._initialize()

        // Setup event listeners
        this.addEventListener('mouseenter', this._onMouseEnter)
        this.addEventListener('mouseleave', this._onMouseLeave)
        this.addEventListener('mousemove', this._onMouseMove)
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeyDown)
        this._slot.addEventListener('slotchange', this._onSlotChange)

        // Sync initial text content for text-mask
        if (this.hasAttribute('text-mask')) {
            this._syncTextSource()
        }

        // Setup resize observer
        this._setupResizeObserver()
    }

    disconnectedCallback() {
        this._isConnected = false

        // Remove event listeners
        this.removeEventListener('mouseenter', this._onMouseEnter)
        this.removeEventListener('mouseleave', this._onMouseLeave)
        this.removeEventListener('mousemove', this._onMouseMove)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeyDown)
        this._slot?.removeEventListener('slotchange', this._onSlotChange)

        // Disconnect observer
        this._resizeObserver?.disconnect()
        this._resizeObserver = null

        // Destroy button
        this._button?.destroy()
        this._button = null
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return
        if (!this._button) return
        if (!this._button.isInitialized) return  // Don't update before init completes

        switch (name) {
            case 'shader':
                this._button.setShader(newValue)
                break
            case 'mode':
                // Handled by CSS - mode controls visual border, not shader
                break
            case 'variant':
                this._button.setVariant(newValue || null)
                break
            case 'border-width':
                // Update CSS variable for border width
                this.style.setProperty('--border-width', `${parseFloat(newValue) * 48 || 3}px`)
                break
            case 'intensity':
                this._button.options.intensity = parseFloat(newValue) || 0.5
                break
            case 'disabled':
                // Handled by CSS :host([disabled])
                break
            case 'size':
                // Handled by CSS :host([size="..."])
                break
            case 'animate':
                // Toggle continuous animation
                this._button?.setAnimating(newValue !== null)
                break
            case 'text-mask':
                // Sync text source when text-mask is toggled
                if (newValue !== null) {
                    this._syncTextSource()
                }
                break
        }
    }

    /**
     * Parse attributes into options object
     */
    _parseAttributes() {
        const options = {}

        for (const [attr, opt] of Object.entries(ATTR_TO_OPTION)) {
            if (this.hasAttribute(attr)) {
                let value = this.getAttribute(attr)

                // Handle numeric attributes
                if (attr === 'border-width' || attr === 'intensity') {
                    value = parseFloat(value)
                }

                // Handle resting-tilt and resting-focus as "x,y" arrays
                if (attr === 'resting-tilt' || attr === 'resting-focus') {
                    const parts = value.split(',').map(v => parseFloat(v.trim()))
                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                        value = parts
                    } else {
                        continue // Skip invalid format
                    }
                }

                options[opt] = value
            }
        }

        return options
    }

    /**
     * Initialize the shader button
     */
    async _initialize() {
        // Wait for next frame to ensure layout is complete
        await new Promise(resolve => requestAnimationFrame(resolve))

        try {
            // IMPORTANT: Set animating state BEFORE initialize()
            // so _doInitialRender sees it and doesn't release context
            if (this.hasAttribute('animate')) {
                this._button.isAnimating = true
            }

            await this._button.initialize()

            // Now call setAnimating to ensure render loop starts
            if (this.hasAttribute('animate')) {
                this._button.setAnimating(true)
            }
        } catch (err) {
            console.error('ShaderButton initialization failed:', err)
        }
    }

    /**
     * Setup resize observer
     */
    _setupResizeObserver() {
        this._resizeObserver = new ResizeObserver(entries => {
            if (!this._button) return

            const { width, height } = entries[0].contentRect
            if (width === 0 || height === 0) return

            const dpr = window.devicePixelRatio || 1
            const newWidth = width * dpr
            const newHeight = height * dpr

            // Update target canvas size
            this._canvas.width = newWidth
            this._canvas.height = newHeight

            // Resize borrowed context if we have one
            if (this._button._borrowedContext) {
                this._button._borrowedContext.resize(newWidth, newHeight)
            }

            // Get fresh 2D context after resize
            this._button._targetCtx = this._canvas.getContext('2d')
        })

        this._resizeObserver.observe(this)
    }

    /**
     * Handle slot content changes
     */
    _onSlotChange() {
        if (this.hasAttribute('text-mask')) {
            this._syncTextSource()
        }
    }

    /**
     * Sync text content to overlay and ensure SVG filter exists
     */
    _syncTextSource() {
        // Copy text to overlay
        const text = this.textContent.trim()
        this._overlayText.textContent = text
        // SVG filter is now embedded in Shadow DOM template
    }

    /**
     * Mouse enter handler
     */
    _onMouseEnter() {
        this._button?.setHovering(true)
    }

    /**
     * Mouse leave handler
     */
    _onMouseLeave() {
        this._button?.setHovering(false)
    }

    /**
     * Mouse move handler
     */
    _onMouseMove(event) {
        if (!this._button) return

        const rect = this.getBoundingClientRect()
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1

        this._button.setMousePosition(x, y)
    }

    /**
     * Click handler
     */
    _onClick(event) {
        if (this.hasAttribute('disabled')) {
            event.preventDefault()
            event.stopPropagation()
        }
    }

    /**
     * Keyboard handler (for accessibility)
     */
    _onKeyDown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.click()
        }
    }

    // ==================== Public API ====================

    /**
     * Set the shader effect
     */
    setShader(name) {
        this.setAttribute('shader', name)
    }

    /**
     * Set the effect mode
     */
    setMode(mode) {
        this.setAttribute('mode', mode)
    }

    /**
     * Set the variant color
     */
    setVariant(variant) {
        if (variant) {
            this.setAttribute('variant', variant)
        } else {
            this.removeAttribute('variant')
        }
    }

    /**
     * Set disabled state
     */
    set disabled(value) {
        if (value) {
            this.setAttribute('disabled', '')
        } else {
            this.removeAttribute('disabled')
        }
    }

    get disabled() {
        return this.hasAttribute('disabled')
    }

    // ==================== Static ====================

    /**
     * Get available shader names
     */
    static get shaderNames() {
        return ShaderButton.shaderNames
    }

    /**
     * Get available variant names
     */
    static get variantNames() {
        return ShaderButton.variantNames
    }
}

// Register custom element
customElements.define('shader-button', ShaderButtonElement)

export { ShaderButtonElement, ShaderButton }
