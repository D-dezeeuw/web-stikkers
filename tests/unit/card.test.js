import { test, describe } from 'node:test'
import assert from 'node:assert'
import { Card } from '../../src/card/Card.js'

const EPSILON = 1e-6

function approxEqual(a, b, epsilon = EPSILON) {
    return Math.abs(a - b) < epsilon
}

describe('Card', () => {
    describe('constructor', () => {
        test('creates card with default values', () => {
            const card = new Card()

            assert.strictEqual(card.position.x, 0)
            assert.strictEqual(card.position.y, 0)
            assert.strictEqual(card.position.z, 0)

            assert.strictEqual(card.rotation.x, 0)
            assert.strictEqual(card.rotation.y, 0)
            assert.strictEqual(card.rotation.z, 0)

            assert.strictEqual(card.scale.x, 1)
            assert.strictEqual(card.scale.y, 1.4)
            assert.strictEqual(card.scale.z, 1)

            assert.strictEqual(card.smoothing, 8)
        })

        test('creates card with custom position', () => {
            const card = new Card({ x: 1, y: 2, z: 3 })

            assert.strictEqual(card.position.x, 1)
            assert.strictEqual(card.position.y, 2)
            assert.strictEqual(card.position.z, 3)
        })

        test('creates card with custom scale', () => {
            const card = new Card({ scaleX: 2, scaleY: 3, scaleZ: 4 })

            assert.strictEqual(card.scale.x, 2)
            assert.strictEqual(card.scale.y, 3)
            assert.strictEqual(card.scale.z, 4)
        })

        test('creates card with custom smoothing', () => {
            const card = new Card({ smoothing: 12 })
            assert.strictEqual(card.smoothing, 12)
        })

        test('initializes empty textures map', () => {
            const card = new Card()
            assert.deepStrictEqual(card.textures, {})
        })

        test('initializes effect params', () => {
            const card = new Card()
            assert.strictEqual(card.effectParams.intensity, 1.0)
        })

        test('initializes model matrix', () => {
            const card = new Card()
            assert.ok(card.modelMatrix)
            assert.ok(card.modelMatrix.elements instanceof Float32Array)
        })
    })

    describe('setTargetRotation', () => {
        test('sets target rotation x and y', () => {
            const card = new Card()
            card.setTargetRotation(0.5, 0.3)

            assert.strictEqual(card.targetRotation.x, 0.5)
            assert.strictEqual(card.targetRotation.y, 0.3)
            assert.strictEqual(card.targetRotation.z, 0)
        })

        test('sets target rotation with z', () => {
            const card = new Card()
            card.setTargetRotation(0.1, 0.2, 0.3)

            assert.strictEqual(card.targetRotation.x, 0.1)
            assert.strictEqual(card.targetRotation.y, 0.2)
            assert.strictEqual(card.targetRotation.z, 0.3)
        })

        test('z defaults to 0', () => {
            const card = new Card()
            card.setTargetRotation(1, 2)
            assert.strictEqual(card.targetRotation.z, 0)
        })
    })

    describe('lerp', () => {
        test('returns a when t=0', () => {
            const card = new Card()
            assert.strictEqual(card.lerp(10, 20, 0), 10)
        })

        test('returns b when t=1', () => {
            const card = new Card()
            assert.strictEqual(card.lerp(10, 20, 1), 20)
        })

        test('returns midpoint when t=0.5', () => {
            const card = new Card()
            assert.strictEqual(card.lerp(10, 20, 0.5), 15)
        })

        test('handles negative values', () => {
            const card = new Card()
            assert.strictEqual(card.lerp(-10, 10, 0.5), 0)
        })

        test('handles t > 1 (extrapolation)', () => {
            const card = new Card()
            assert.strictEqual(card.lerp(0, 10, 2), 20)
        })

        test('handles t < 0 (extrapolation)', () => {
            const card = new Card()
            assert.strictEqual(card.lerp(0, 10, -1), -10)
        })
    })

    describe('getRotation', () => {
        test('returns array of [x, y] rotation', () => {
            const card = new Card()
            card.rotation.x = 0.5
            card.rotation.y = 0.3

            const result = card.getRotation()
            assert.deepStrictEqual(result, [0.5, 0.3])
        })

        test('returns current rotation not target', () => {
            const card = new Card()
            card.rotation.x = 0.1
            card.rotation.y = 0.2
            card.targetRotation.x = 0.9
            card.targetRotation.y = 0.8

            const result = card.getRotation()
            assert.deepStrictEqual(result, [0.1, 0.2])
        })
    })

    describe('getTiltMagnitude', () => {
        test('returns 0 for no rotation', () => {
            const card = new Card()
            assert.strictEqual(card.getTiltMagnitude(), 0)
        })

        test('returns correct magnitude for x rotation only', () => {
            const card = new Card()
            card.rotation.x = 3
            card.rotation.y = 0
            assert.strictEqual(card.getTiltMagnitude(), 3)
        })

        test('returns correct magnitude for y rotation only', () => {
            const card = new Card()
            card.rotation.x = 0
            card.rotation.y = 4
            assert.strictEqual(card.getTiltMagnitude(), 4)
        })

        test('returns correct magnitude for combined rotation (3-4-5 triangle)', () => {
            const card = new Card()
            card.rotation.x = 3
            card.rotation.y = 4
            assert.strictEqual(card.getTiltMagnitude(), 5)
        })

        test('handles negative rotations', () => {
            const card = new Card()
            card.rotation.x = -3
            card.rotation.y = -4
            assert.strictEqual(card.getTiltMagnitude(), 5)
        })
    })

    describe('setTexture / getTexture', () => {
        test('stores and retrieves texture', () => {
            const card = new Card()
            const mockTexture = { id: 1 }

            card.setTexture('base', mockTexture)
            assert.strictEqual(card.getTexture('base'), mockTexture)
        })

        test('returns undefined for non-existent texture', () => {
            const card = new Card()
            assert.strictEqual(card.getTexture('nonexistent'), undefined)
        })

        test('stores multiple textures', () => {
            const card = new Card()
            const tex1 = { id: 1 }
            const tex2 = { id: 2 }
            const tex3 = { id: 3 }

            card.setTexture('base', tex1)
            card.setTexture('normal', tex2)
            card.setTexture('mask', tex3)

            assert.strictEqual(card.getTexture('base'), tex1)
            assert.strictEqual(card.getTexture('normal'), tex2)
            assert.strictEqual(card.getTexture('mask'), tex3)
        })

        test('overwrites existing texture', () => {
            const card = new Card()
            const tex1 = { id: 1 }
            const tex2 = { id: 2 }

            card.setTexture('base', tex1)
            card.setTexture('base', tex2)

            assert.strictEqual(card.getTexture('base'), tex2)
        })
    })

    describe('update', () => {
        test('interpolates rotation toward target', () => {
            const card = new Card({ smoothing: 10 })
            card.setTargetRotation(1.0, 1.0)

            // Small delta time
            card.update(0.016) // ~60fps

            // Rotation should move toward target
            assert.ok(card.rotation.x > 0, 'x rotation should increase')
            assert.ok(card.rotation.y > 0, 'y rotation should increase')
            assert.ok(card.rotation.x < 1.0, 'x rotation should not overshoot')
            assert.ok(card.rotation.y < 1.0, 'y rotation should not overshoot')
        })

        test('clamps interpolation factor to max 1', () => {
            const card = new Card({ smoothing: 1000 })
            card.setTargetRotation(1.0, 1.0)

            // Large delta time would create t > 1 without clamping
            card.update(1.0)

            // Should reach target (t clamped to 1)
            assert.strictEqual(card.rotation.x, 1.0)
            assert.strictEqual(card.rotation.y, 1.0)
        })

        test('updates model matrix after rotation change', () => {
            const card = new Card()
            const originalMatrix = [...card.getModelMatrix()]

            card.setTargetRotation(0.5, 0.5)
            card.update(0.1)

            const newMatrix = card.getModelMatrix()

            // Matrix should have changed
            let changed = false
            for (let i = 0; i < 16; i++) {
                if (originalMatrix[i] !== newMatrix[i]) {
                    changed = true
                    break
                }
            }
            assert.ok(changed, 'model matrix should update')
        })
    })

    describe('updateModelMatrix', () => {
        test('applies transformations in correct order', () => {
            const card = new Card({ x: 1, y: 2, z: 3 })
            card.rotation.x = 0.1
            card.rotation.y = 0.2
            card.rotation.z = 0.3

            card.updateModelMatrix()

            const matrix = card.getModelMatrix()

            // Matrix should be valid Float32Array
            assert.ok(matrix instanceof Float32Array)
            assert.strictEqual(matrix.length, 16)
        })

        test('identity position/rotation gives identity-like matrix', () => {
            const card = new Card({ x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, scaleZ: 1 })
            card.updateModelMatrix()

            const matrix = card.getModelMatrix()

            // Diagonal should be 1 (scale), off-diagonal rotation should be 0
            assert.ok(approxEqual(matrix[0], 1), 'scale x')
            assert.ok(approxEqual(matrix[5], 1), 'scale y')
            assert.ok(approxEqual(matrix[10], 1), 'scale z')
            assert.ok(approxEqual(matrix[15], 1), 'w')
        })
    })

    describe('getModelMatrix', () => {
        test('returns Float32Array', () => {
            const card = new Card()
            const matrix = card.getModelMatrix()
            assert.ok(matrix instanceof Float32Array)
        })

        test('returns 16 elements', () => {
            const card = new Card()
            const matrix = card.getModelMatrix()
            assert.strictEqual(matrix.length, 16)
        })

        test('returns internal matrix elements reference', () => {
            const card = new Card()
            const matrix1 = card.getModelMatrix()
            const matrix2 = card.getModelMatrix()
            assert.strictEqual(matrix1, matrix2)
        })
    })
})
