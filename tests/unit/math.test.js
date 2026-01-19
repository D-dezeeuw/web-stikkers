import { test, describe } from 'node:test'
import assert from 'node:assert'
import { Vector3 } from '../../src/math/Vector3.js'
import { Matrix4 } from '../../src/math/Matrix4.js'

const EPSILON = 1e-6

function approxEqual(a, b, epsilon = EPSILON) {
    return Math.abs(a - b) < epsilon
}

function assertApproxEqual(actual, expected, message) {
    assert.ok(approxEqual(actual, expected),
        `${message}: expected ${expected}, got ${actual}`)
}

// ============================================================================
// Vector3 Tests
// ============================================================================

describe('Vector3', () => {
    describe('constructor', () => {
        test('creates zero vector by default', () => {
            const v = new Vector3()
            assert.strictEqual(v.x, 0)
            assert.strictEqual(v.y, 0)
            assert.strictEqual(v.z, 0)
        })

        test('creates vector with given values', () => {
            const v = new Vector3(1, 2, 3)
            assert.strictEqual(v.x, 1)
            assert.strictEqual(v.y, 2)
            assert.strictEqual(v.z, 3)
        })
    })

    describe('set', () => {
        test('sets vector components', () => {
            const v = new Vector3()
            v.set(4, 5, 6)
            assert.strictEqual(v.x, 4)
            assert.strictEqual(v.y, 5)
            assert.strictEqual(v.z, 6)
        })

        test('returns this for chaining', () => {
            const v = new Vector3()
            const result = v.set(1, 2, 3)
            assert.strictEqual(result, v)
        })
    })

    describe('copy', () => {
        test('copies another vector', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3()
            b.copy(a)
            assert.strictEqual(b.x, 1)
            assert.strictEqual(b.y, 2)
            assert.strictEqual(b.z, 3)
        })

        test('returns this for chaining', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3()
            assert.strictEqual(b.copy(a), b)
        })
    })

    describe('clone', () => {
        test('creates independent copy', () => {
            const a = new Vector3(1, 2, 3)
            const b = a.clone()
            assert.strictEqual(b.x, 1)
            assert.strictEqual(b.y, 2)
            assert.strictEqual(b.z, 3)

            // Modify original, clone should not change
            a.x = 10
            assert.strictEqual(b.x, 1)
        })
    })

    describe('add', () => {
        test('adds two vectors', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3(4, 5, 6)
            a.add(b)
            assert.strictEqual(a.x, 5)
            assert.strictEqual(a.y, 7)
            assert.strictEqual(a.z, 9)
        })

        test('returns this for chaining', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3(4, 5, 6)
            assert.strictEqual(a.add(b), a)
        })
    })

    describe('sub', () => {
        test('subtracts two vectors', () => {
            const a = new Vector3(5, 7, 9)
            const b = new Vector3(1, 2, 3)
            a.sub(b)
            assert.strictEqual(a.x, 4)
            assert.strictEqual(a.y, 5)
            assert.strictEqual(a.z, 6)
        })
    })

    describe('multiplyScalar', () => {
        test('multiplies by scalar', () => {
            const v = new Vector3(1, 2, 3)
            v.multiplyScalar(2)
            assert.strictEqual(v.x, 2)
            assert.strictEqual(v.y, 4)
            assert.strictEqual(v.z, 6)
        })

        test('multiplies by zero', () => {
            const v = new Vector3(1, 2, 3)
            v.multiplyScalar(0)
            assert.strictEqual(v.x, 0)
            assert.strictEqual(v.y, 0)
            assert.strictEqual(v.z, 0)
        })
    })

    describe('dot', () => {
        test('computes dot product', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3(4, 5, 6)
            // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
            assert.strictEqual(a.dot(b), 32)
        })

        test('perpendicular vectors have zero dot product', () => {
            const a = new Vector3(1, 0, 0)
            const b = new Vector3(0, 1, 0)
            assert.strictEqual(a.dot(b), 0)
        })
    })

    describe('cross', () => {
        test('computes cross product', () => {
            const a = new Vector3(1, 0, 0)
            const b = new Vector3(0, 1, 0)
            a.cross(b)
            // i x j = k
            assert.strictEqual(a.x, 0)
            assert.strictEqual(a.y, 0)
            assert.strictEqual(a.z, 1)
        })

        test('cross product is anti-commutative', () => {
            const a = new Vector3(1, 0, 0)
            const b = new Vector3(0, 1, 0)
            const aCrossB = a.clone().cross(b)
            const bCrossA = b.clone().cross(a)
            assert.strictEqual(aCrossB.z, -bCrossA.z)
        })
    })

    describe('length', () => {
        test('computes vector length', () => {
            const v = new Vector3(3, 4, 0)
            assert.strictEqual(v.length(), 5)
        })

        test('zero vector has zero length', () => {
            const v = new Vector3(0, 0, 0)
            assert.strictEqual(v.length(), 0)
        })

        test('unit vectors have length 1', () => {
            const v = new Vector3(1, 0, 0)
            assert.strictEqual(v.length(), 1)
        })
    })

    describe('normalize', () => {
        test('normalizes vector to unit length', () => {
            const v = new Vector3(3, 4, 0)
            v.normalize()
            assertApproxEqual(v.length(), 1, 'normalized length')
            assertApproxEqual(v.x, 0.6, 'x component')
            assertApproxEqual(v.y, 0.8, 'y component')
        })

        test('handles zero vector gracefully', () => {
            const v = new Vector3(0, 0, 0)
            v.normalize()
            assert.strictEqual(v.x, 0)
            assert.strictEqual(v.y, 0)
            assert.strictEqual(v.z, 0)
        })
    })

    describe('lerp', () => {
        test('interpolates between vectors', () => {
            const a = new Vector3(0, 0, 0)
            const b = new Vector3(10, 20, 30)
            a.lerp(b, 0.5)
            assert.strictEqual(a.x, 5)
            assert.strictEqual(a.y, 10)
            assert.strictEqual(a.z, 15)
        })

        test('t=0 returns original', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3(10, 20, 30)
            a.lerp(b, 0)
            assert.strictEqual(a.x, 1)
            assert.strictEqual(a.y, 2)
            assert.strictEqual(a.z, 3)
        })

        test('t=1 returns target', () => {
            const a = new Vector3(1, 2, 3)
            const b = new Vector3(10, 20, 30)
            a.lerp(b, 1)
            assert.strictEqual(a.x, 10)
            assert.strictEqual(a.y, 20)
            assert.strictEqual(a.z, 30)
        })
    })

    describe('toArray', () => {
        test('converts to array', () => {
            const v = new Vector3(1, 2, 3)
            const arr = v.toArray()
            assert.deepStrictEqual(arr, [1, 2, 3])
        })
    })
})

// ============================================================================
// Matrix4 Tests
// ============================================================================

describe('Matrix4', () => {
    describe('constructor', () => {
        test('creates identity matrix by default', () => {
            const m = new Matrix4()
            const e = m.elements
            // Identity matrix check
            assert.strictEqual(e[0], 1); assert.strictEqual(e[4], 0); assert.strictEqual(e[8], 0); assert.strictEqual(e[12], 0)
            assert.strictEqual(e[1], 0); assert.strictEqual(e[5], 1); assert.strictEqual(e[9], 0); assert.strictEqual(e[13], 0)
            assert.strictEqual(e[2], 0); assert.strictEqual(e[6], 0); assert.strictEqual(e[10], 1); assert.strictEqual(e[14], 0)
            assert.strictEqual(e[3], 0); assert.strictEqual(e[7], 0); assert.strictEqual(e[11], 0); assert.strictEqual(e[15], 1)
        })
    })

    describe('identity', () => {
        test('resets to identity matrix', () => {
            const m = new Matrix4()
            m.elements[0] = 99  // Modify
            m.identity()
            assert.strictEqual(m.elements[0], 1)
            assert.strictEqual(m.elements[5], 1)
            assert.strictEqual(m.elements[10], 1)
            assert.strictEqual(m.elements[15], 1)
        })
    })

    describe('copy', () => {
        test('copies another matrix', () => {
            const a = new Matrix4()
            a.elements[0] = 42
            const b = new Matrix4()
            b.copy(a)
            assert.strictEqual(b.elements[0], 42)
        })
    })

    describe('clone', () => {
        test('creates independent copy', () => {
            const a = new Matrix4()
            a.elements[0] = 42
            const b = a.clone()
            assert.strictEqual(b.elements[0], 42)

            a.elements[0] = 99
            assert.strictEqual(b.elements[0], 42)
        })
    })

    describe('multiply', () => {
        test('identity * identity = identity', () => {
            const a = new Matrix4()
            const b = new Matrix4()
            a.multiply(b)
            assert.strictEqual(a.elements[0], 1)
            assert.strictEqual(a.elements[5], 1)
            assert.strictEqual(a.elements[10], 1)
            assert.strictEqual(a.elements[15], 1)
        })

        test('matrix * identity = matrix', () => {
            const a = new Matrix4()
            a.translate(1, 2, 3)
            const original = a.clone()
            const identity = new Matrix4()
            a.multiply(identity)
            for (let i = 0; i < 16; i++) {
                assertApproxEqual(a.elements[i], original.elements[i], `element ${i}`)
            }
        })
    })

    describe('translate', () => {
        test('translates matrix', () => {
            const m = new Matrix4()
            m.translate(10, 20, 30)
            assert.strictEqual(m.elements[12], 10)
            assert.strictEqual(m.elements[13], 20)
            assert.strictEqual(m.elements[14], 30)
        })
    })

    describe('rotateX', () => {
        test('rotates around X axis', () => {
            const m = new Matrix4()
            m.rotateX(Math.PI / 2)  // 90 degrees
            // After 90° rotation around X, Y becomes Z, Z becomes -Y
            assertApproxEqual(m.elements[5], 0, 'cos(90)')
            assertApproxEqual(m.elements[6], 1, 'sin(90)')
            assertApproxEqual(m.elements[9], -1, '-sin(90)')
            assertApproxEqual(m.elements[10], 0, 'cos(90)')
        })
    })

    describe('rotateY', () => {
        test('rotates around Y axis', () => {
            const m = new Matrix4()
            m.rotateY(Math.PI / 2)  // 90 degrees
            assertApproxEqual(m.elements[0], 0, 'cos(90)')
            assertApproxEqual(m.elements[8], 1, 'sin(90)')
        })
    })

    describe('rotateZ', () => {
        test('rotates around Z axis', () => {
            const m = new Matrix4()
            m.rotateZ(Math.PI / 2)  // 90 degrees
            assertApproxEqual(m.elements[0], 0, 'cos(90)')
            assertApproxEqual(m.elements[1], 1, 'sin(90)')
            assertApproxEqual(m.elements[4], -1, '-sin(90)')
            assertApproxEqual(m.elements[5], 0, 'cos(90)')
        })
    })

    describe('scale', () => {
        test('scales matrix', () => {
            const m = new Matrix4()
            m.scale(2, 3, 4)
            assert.strictEqual(m.elements[0], 2)
            assert.strictEqual(m.elements[5], 3)
            assert.strictEqual(m.elements[10], 4)
        })
    })

    describe('perspective', () => {
        test('creates perspective projection matrix', () => {
            const m = new Matrix4()
            const fov = Math.PI / 4  // 45 degrees
            const aspect = 16 / 9
            const near = 0.1
            const far = 100
            m.perspective(fov, aspect, near, far)

            // Check that it's not identity
            assert.notStrictEqual(m.elements[0], 1)
            // w component should be -z (perspective divide)
            assert.strictEqual(m.elements[11], -1)
            assert.strictEqual(m.elements[15], 0)
        })
    })

    describe('orthographic', () => {
        test('creates orthographic projection matrix', () => {
            const m = new Matrix4()
            m.orthographic(-1, 1, -1, 1, 0.1, 100)

            // Orthographic has 1 in bottom-right (no perspective divide)
            assert.strictEqual(m.elements[15], 1)
            assert.strictEqual(m.elements[11], 0)
        })
    })

    describe('lookAt', () => {
        test('creates view matrix looking at target', () => {
            const m = new Matrix4()
            // Camera at (0, 0, 5) looking at origin, up is Y
            m.lookAt(0, 0, 5, 0, 0, 0, 0, 1, 0)

            // Looking down -Z axis from +Z, should have -1 in z direction
            assertApproxEqual(m.elements[10], 1, 'z direction')
        })
    })

    describe('invert', () => {
        test('inverts identity matrix to identity', () => {
            const m = new Matrix4()
            m.invert()
            assert.strictEqual(m.elements[0], 1)
            assert.strictEqual(m.elements[5], 1)
            assert.strictEqual(m.elements[10], 1)
            assert.strictEqual(m.elements[15], 1)
        })

        test('matrix * inverse = identity', () => {
            const m = new Matrix4()
            m.translate(1, 2, 3).rotateX(0.5).scale(2, 2, 2)
            const original = m.clone()
            const inverse = m.clone().invert()
            original.multiply(inverse)

            // Should be close to identity
            assertApproxEqual(original.elements[0], 1, 'e[0]')
            assertApproxEqual(original.elements[5], 1, 'e[5]')
            assertApproxEqual(original.elements[10], 1, 'e[10]')
            assertApproxEqual(original.elements[15], 1, 'e[15]')
        })

        test('handles singular matrix', () => {
            const m = new Matrix4()
            // Zero out to make singular
            for (let i = 0; i < 16; i++) m.elements[i] = 0
            m.invert()  // Should return identity, not throw
            assert.strictEqual(m.elements[0], 1)
        })
    })

    describe('transpose', () => {
        test('transposes matrix', () => {
            const m = new Matrix4()
            m.elements[1] = 2
            m.elements[4] = 3
            m.transpose()
            assert.strictEqual(m.elements[1], 3)
            assert.strictEqual(m.elements[4], 2)
        })

        test('double transpose returns original', () => {
            const m = new Matrix4()
            m.translate(1, 2, 3)
            const original = m.clone()
            m.transpose().transpose()
            for (let i = 0; i < 16; i++) {
                assertApproxEqual(m.elements[i], original.elements[i], `element ${i}`)
            }
        })
    })

    describe('premultiply', () => {
        test('premultiplies matrix', () => {
            const a = new Matrix4().translate(1, 0, 0)
            const b = new Matrix4().translate(0, 1, 0)
            a.premultiply(b)
            // Result should have both translations
            assertApproxEqual(a.elements[12], 1, 'x translation')
            assertApproxEqual(a.elements[13], 1, 'y translation')
        })
    })
})
