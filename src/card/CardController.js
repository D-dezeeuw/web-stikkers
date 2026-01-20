import { CONFIG } from '../config.js'

export class CardController {
    constructor(card, canvas) {
        this.card = card
        this.canvas = canvas
        this.maxTilt = CONFIG.card.maxTiltRadians

        this.mouseX = 0
        this.mouseY = 0
        this.isHovering = false

        // Idle animation parameters
        this.time = 0
        this.idleSpeed = CONFIG.idle.speed
        this.idleAmount = CONFIG.idle.amplitude

        // Cached bounding rect (updated on resize/enter, not every mouse move)
        this._cachedRect = null
        this._resizeObserver = null

        // Bind methods for proper event listener removal
        this.handleMouseMove = this.onMouseMove.bind(this)
        this.handleMouseLeave = this.onMouseLeave.bind(this)
        this.handleMouseEnter = this.onMouseEnter.bind(this)
        this.handleTouchMove = this.onTouchMove.bind(this)

        this.bindEvents()
        this._setupResizeObserver()

        // Check if mouse is already over canvas (e.g., overlay opened under cursor)
        if (this.canvas.matches(':hover')) {
            this.isHovering = true
            this._updateCachedRect()
        }
    }

    /**
     * Setup ResizeObserver to invalidate cached rect when canvas resizes
     */
    _setupResizeObserver() {
        this._resizeObserver = new ResizeObserver(() => {
            this._cachedRect = null  // Invalidate cache on resize
        })
        this._resizeObserver.observe(this.canvas)
    }

    /**
     * Update the cached bounding rect
     */
    _updateCachedRect() {
        this._cachedRect = this.canvas.getBoundingClientRect()
    }

    /**
     * Get the cached rect, updating if necessary
     */
    _getRect() {
        if (!this._cachedRect) {
            this._updateCachedRect()
        }
        return this._cachedRect
    }

    update(deltaTime) {
        this.time += deltaTime

        if (!this.isHovering) {
            // Idle wobble animation using sine waves with different frequencies
            const wobbleX = Math.sin(this.time * this.idleSpeed) * this.idleAmount
            const wobbleY = Math.sin(this.time * this.idleSpeed * 0.7 + 1.0) * this.idleAmount
            this.card.setTargetRotation(wobbleX, wobbleY, 0)
        }
    }

    bindEvents() {
        this.canvas.addEventListener('mousemove', this.handleMouseMove)
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave)
        this.canvas.addEventListener('mouseenter', this.handleMouseEnter)

        // Touch support (passive: false needed for preventDefault to stop page scroll)
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false })
        this.canvas.addEventListener('touchend', this.handleMouseLeave)
    }

    onMouseMove(event) {
        const rect = this._getRect()

        // Calculate mouse position relative to canvas center, normalized to -1 to 1
        this.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1

        this.updateCardTilt()
    }

    onTouchMove(event) {
        event.preventDefault()
        const touch = event.touches[0]
        const rect = this._getRect()

        this.mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1
        this.mouseY = ((touch.clientY - rect.top) / rect.height) * 2 - 1

        this.updateCardTilt()
    }

    onMouseEnter() {
        this.isHovering = true
        // Refresh cached rect on mouse enter (handles scroll/layout changes)
        this._updateCachedRect()
    }

    onMouseLeave() {
        this.isHovering = false
        // Idle animation will take over
    }

    updateCardTilt() {
        if (!this.isHovering) return

        // Convert mouse position to tilt angles
        // Horizontal mouse movement -> Y-axis rotation (card tilts left/right)
        // Vertical mouse movement -> X-axis rotation (card tilts up/down)
        const tiltY = this.mouseX * this.maxTilt
        const tiltX = -this.mouseY * this.maxTilt

        this.card.setTargetRotation(tiltX, tiltY, 0)
    }

    getMousePosition() {
        return [this.mouseX, this.mouseY]
    }

    destroy() {
        this.canvas.removeEventListener('mousemove', this.handleMouseMove)
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave)
        this.canvas.removeEventListener('mouseenter', this.handleMouseEnter)
        this.canvas.removeEventListener('touchmove', this.handleTouchMove)
        this.canvas.removeEventListener('touchend', this.handleMouseLeave)

        // Clean up ResizeObserver
        if (this._resizeObserver) {
            this._resizeObserver.disconnect()
            this._resizeObserver = null
        }
        this._cachedRect = null
    }
}
