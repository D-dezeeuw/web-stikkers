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

        // Bind methods for proper event listener removal
        this.handleMouseMove = this.onMouseMove.bind(this)
        this.handleMouseLeave = this.onMouseLeave.bind(this)
        this.handleMouseEnter = this.onMouseEnter.bind(this)
        this.handleTouchMove = this.onTouchMove.bind(this)

        this.bindEvents()
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

        // Touch support
        this.canvas.addEventListener('touchmove', this.handleTouchMove)
        this.canvas.addEventListener('touchend', this.handleMouseLeave)
    }

    onMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect()

        // Calculate mouse position relative to canvas center, normalized to -1 to 1
        this.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1
        this.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1

        this.updateCardTilt()
    }

    onTouchMove(event) {
        event.preventDefault()
        const touch = event.touches[0]
        const rect = this.canvas.getBoundingClientRect()

        this.mouseX = ((touch.clientX - rect.left) / rect.width) * 2 - 1
        this.mouseY = ((touch.clientY - rect.top) / rect.height) * 2 - 1

        this.updateCardTilt()
    }

    onMouseEnter() {
        this.isHovering = true
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
    }
}
