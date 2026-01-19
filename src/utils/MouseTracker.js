export class MouseTracker {
    constructor(element) {
        this.element = element
        this.x = 0
        this.y = 0
        this.normalizedX = 0
        this.normalizedY = 0
        this.isInside = false

        this.bindEvents()
    }

    bindEvents() {
        this.element.addEventListener('mousemove', (e) => this.onMouseMove(e))
        this.element.addEventListener('mouseenter', () => this.isInside = true)
        this.element.addEventListener('mouseleave', () => {
            this.isInside = false
            this.normalizedX = 0
            this.normalizedY = 0
        })
    }

    onMouseMove(event) {
        const rect = this.element.getBoundingClientRect()

        this.x = event.clientX - rect.left
        this.y = event.clientY - rect.top

        // Normalized -1 to 1
        this.normalizedX = (this.x / rect.width) * 2 - 1
        this.normalizedY = (this.y / rect.height) * 2 - 1
    }

    getNormalized() {
        return [this.normalizedX, this.normalizedY]
    }

    getPixel() {
        return [this.x, this.y]
    }
}
