import { test, describe } from 'node:test'
import assert from 'node:assert'
import { smoothstep } from '../../src/core/MaskFactory.js'

const EPSILON = 1e-6

function approxEqual(a, b, epsilon = EPSILON) {
    return Math.abs(a - b) < epsilon
}

describe('smoothstep', () => {
    test('returns 0 at lower edge', () => {
        const result = smoothstep(0, 1, 0)
        assert.strictEqual(result, 0)
    })

    test('returns 1 at upper edge', () => {
        const result = smoothstep(0, 1, 1)
        assert.strictEqual(result, 1)
    })

    test('returns 0.5 at midpoint', () => {
        const result = smoothstep(0, 1, 0.5)
        assert.strictEqual(result, 0.5)
    })

    test('returns 0 below lower edge', () => {
        const result = smoothstep(0, 1, -0.5)
        assert.strictEqual(result, 0)
    })

    test('returns 1 above upper edge', () => {
        const result = smoothstep(0, 1, 1.5)
        assert.strictEqual(result, 1)
    })

    test('is symmetric around midpoint', () => {
        const low = smoothstep(0, 1, 0.25)
        const high = smoothstep(0, 1, 0.75)
        assert.ok(approxEqual(low + high, 1), `${low} + ${high} should equal 1`)
    })

    test('works with arbitrary edge values', () => {
        const result = smoothstep(10, 20, 15)
        assert.strictEqual(result, 0.5)
    })

    test('works with negative edges', () => {
        const result = smoothstep(-1, 1, 0)
        assert.strictEqual(result, 0.5)
    })

    test('has zero derivative at edges (smooth)', () => {
        // Test that the curve is smooth at boundaries
        // At edges, derivative should be 0, so values near edge should be very close to edge value
        const nearLow = smoothstep(0, 1, 0.001)
        const nearHigh = smoothstep(0, 1, 0.999)

        // Near edge values should be very small/large due to smooth transition
        assert.ok(nearLow < 0.01, `near low edge: ${nearLow}`)
        assert.ok(nearHigh > 0.99, `near high edge: ${nearHigh}`)
    })

    test('follows smoothstep formula: t*t*(3-2*t)', () => {
        // For t = 0.25: 0.25^2 * (3 - 2*0.25) = 0.0625 * 2.5 = 0.15625
        const result = smoothstep(0, 1, 0.25)
        assert.ok(approxEqual(result, 0.15625), `expected 0.15625, got ${result}`)

        // For t = 0.75: 0.75^2 * (3 - 2*0.75) = 0.5625 * 1.5 = 0.84375
        const result2 = smoothstep(0, 1, 0.75)
        assert.ok(approxEqual(result2, 0.84375), `expected 0.84375, got ${result2}`)
    })

    test('clamps input to [0, 1] range before applying formula', () => {
        // Values outside range should be clamped
        assert.strictEqual(smoothstep(0, 1, -100), 0)
        assert.strictEqual(smoothstep(0, 1, 100), 1)
    })

    test('handles edge0 > edge1 (inverted range)', () => {
        // When edge0 > edge1, the interpolation is inverted
        const result = smoothstep(1, 0, 0.5)
        // t = (0.5 - 1) / (0 - 1) = -0.5 / -1 = 0.5
        assert.strictEqual(result, 0.5)
    })

    test('handles edge0 === edge1 (degenerate case)', () => {
        // When edges are equal, division by zero occurs: (x-edge0)/(edge1-edge0) = 0/0 = NaN
        // This is mathematically undefined, and the function returns NaN
        const result = smoothstep(5, 5, 5)
        assert.ok(isNaN(result), 'division by zero produces NaN')
    })
})
