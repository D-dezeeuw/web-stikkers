import { Matrix4 } from '../math/Matrix4.js'

export class Card {
    constructor(options = {}) {
        this.position = {
            x: options.x ?? 0,
            y: options.y ?? 0,
            z: options.z ?? 0
        }

        this.rotation = {
            x: 0,
            y: 0,
            z: 0
        }

        this.targetRotation = {
            x: 0,
            y: 0,
            z: 0
        }

        this.scale = {
            x: options.scaleX ?? 1,
            y: options.scaleY ?? 1.4,
            z: options.scaleZ ?? 1
        }

        this.textures = {}
        this.effectParams = {
            intensity: 1.0
        }

        this.modelMatrix = new Matrix4()
        this.smoothing = options.smoothing ?? 8
    }

    setTargetRotation(x, y, z = 0) {
        this.targetRotation.x = x
        this.targetRotation.y = y
        this.targetRotation.z = z
    }

    update(deltaTime) {
        // Smooth interpolation toward target rotation
        const t = Math.min(1, deltaTime * this.smoothing)

        this.rotation.x = this.lerp(this.rotation.x, this.targetRotation.x, t)
        this.rotation.y = this.lerp(this.rotation.y, this.targetRotation.y, t)
        this.rotation.z = this.lerp(this.rotation.z, this.targetRotation.z, t)

        this.updateModelMatrix()
    }

    lerp(a, b, t) {
        return a + (b - a) * t
    }

    updateModelMatrix() {
        this.modelMatrix.identity()
        this.modelMatrix.translate(this.position.x, this.position.y, this.position.z)
        this.modelMatrix.rotateX(this.rotation.x)
        this.modelMatrix.rotateY(this.rotation.y)
        this.modelMatrix.rotateZ(this.rotation.z)
        this.modelMatrix.scale(this.scale.x, this.scale.y, this.scale.z)
    }

    getModelMatrix() {
        return this.modelMatrix.elements
    }

    getRotation() {
        return [this.rotation.x, this.rotation.y]
    }

    getTiltMagnitude() {
        return Math.sqrt(
            this.rotation.x * this.rotation.x +
            this.rotation.y * this.rotation.y
        )
    }

    setTexture(name, texture) {
        this.textures[name] = texture
    }

    getTexture(name) {
        return this.textures[name]
    }
}
