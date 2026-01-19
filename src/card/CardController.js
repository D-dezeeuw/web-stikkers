export class CardController {
    constructor(card, canvas) {
        this.card = card
        this.canvas = canvas
        this.maxTilt = 0.35  // ~20 degrees in radians

        this.mouseX = 0
        this.mouseY = 0
        this.isHovering = false

        // Idle animation parameters
        this.time = 0
        this.idleSpeed = 1.5  // Wobble speed
        this.idleAmount = 0.15  // Wobble amplitude (radians, ~8 degrees)

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
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e))
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave())
        this.canvas.addEventListener('mouseenter', () => this.onMouseEnter())

        // Touch support
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e))
        this.canvas.addEventListener('touchend', () => this.onMouseLeave())
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
        this.canvas.removeEventListener('mousemove', this.onMouseMove)
        this.canvas.removeEventListener('mouseleave', this.onMouseLeave)
        this.canvas.removeEventListener('mouseenter', this.onMouseEnter)
        this.canvas.removeEventListener('touchmove', this.onTouchMove)
        this.canvas.removeEventListener('touchend', this.onMouseLeave)
    }
}
