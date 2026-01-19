import { test, describe } from 'node:test'
import assert from 'node:assert'
import { seededRandom, hslToRgb } from '../../src/core/ProceduralTextures.js'

const EPSILON = 1e-6

function approxEqual(a, b, epsilon = EPSILON) {
    return Math.abs(a - b) < epsilon
}

describe('seededRandom', () => {
    test('returns value between 0 and 1', () => {
        for (let seed = 0; seed < 100; seed++) {
            const value = seededRandom(seed)
            assert.ok(value >= 0 && value < 1, `seed ${seed} produced ${value}`)
        }
    })

    test('is deterministic - same seed gives same result', () => {
        const seed = 42
        const result1 = seededRandom(seed)
        const result2 = seededRandom(seed)
        assert.strictEqual(result1, result2)
    })

    test('different seeds give different results', () => {
        const result1 = seededRandom(1)
        const result2 = seededRandom(2)
        const result3 = seededRandom(3)
        assert.notStrictEqual(result1, result2)
        assert.notStrictEqual(result2, result3)
    })

    test('handles negative seeds', () => {
        const value = seededRandom(-42)
        assert.ok(value >= 0 && value < 1)
    })

    test('handles large seeds', () => {
        const value = seededRandom(1000000)
        assert.ok(value >= 0 && value < 1)
    })

    test('handles fractional seeds', () => {
        const value = seededRandom(1.5)
        assert.ok(value >= 0 && value < 1)
    })
})

describe('hslToRgb', () => {
    test('converts red (0°)', () => {
        const [r, g, b] = hslToRgb(0, 1.0, 0.5)
        assert.strictEqual(r, 255)
        assert.strictEqual(g, 0)
        assert.strictEqual(b, 0)
    })

    test('converts green (120°)', () => {
        const [r, g, b] = hslToRgb(120, 1.0, 0.5)
        assert.strictEqual(r, 0)
        assert.strictEqual(g, 255)
        assert.strictEqual(b, 0)
    })

    test('converts blue (240°)', () => {
        const [r, g, b] = hslToRgb(240, 1.0, 0.5)
        assert.strictEqual(r, 0)
        assert.strictEqual(g, 0)
        assert.strictEqual(b, 255)
    })

    test('converts yellow (60°)', () => {
        const [r, g, b] = hslToRgb(60, 1.0, 0.5)
        assert.strictEqual(r, 255)
        assert.strictEqual(g, 255)
        assert.strictEqual(b, 0)
    })

    test('converts cyan (180°)', () => {
        const [r, g, b] = hslToRgb(180, 1.0, 0.5)
        assert.strictEqual(r, 0)
        assert.strictEqual(g, 255)
        assert.strictEqual(b, 255)
    })

    test('converts magenta (300°)', () => {
        const [r, g, b] = hslToRgb(300, 1.0, 0.5)
        assert.strictEqual(r, 255)
        assert.strictEqual(g, 0)
        assert.strictEqual(b, 255)
    })

    test('converts white (any hue, 100% lightness)', () => {
        const [r, g, b] = hslToRgb(0, 1.0, 1.0)
        assert.strictEqual(r, 255)
        assert.strictEqual(g, 255)
        assert.strictEqual(b, 255)
    })

    test('converts black (any hue, 0% lightness)', () => {
        const [r, g, b] = hslToRgb(0, 1.0, 0)
        assert.strictEqual(r, 0)
        assert.strictEqual(g, 0)
        assert.strictEqual(b, 0)
    })

    test('converts gray (0% saturation)', () => {
        const [r, g, b] = hslToRgb(0, 0, 0.5)
        assert.strictEqual(r, 128)
        assert.strictEqual(g, 128)
        assert.strictEqual(b, 128)
    })

    test('converts dark gray', () => {
        const [r, g, b] = hslToRgb(0, 0, 0.25)
        assert.strictEqual(r, 64)
        assert.strictEqual(g, 64)
        assert.strictEqual(b, 64)
    })

    test('converts light gray', () => {
        const [r, g, b] = hslToRgb(0, 0, 0.75)
        assert.strictEqual(r, 191)
        assert.strictEqual(g, 191)
        assert.strictEqual(b, 191)
    })

    test('converts desaturated red', () => {
        const [r, g, b] = hslToRgb(0, 0.5, 0.5)
        assert.strictEqual(r, 191)
        assert.strictEqual(g, 64)
        assert.strictEqual(b, 64)
    })

    test('handles hue wrap-around (360° = 0°)', () => {
        const [r1, g1, b1] = hslToRgb(0, 1.0, 0.5)
        const [r2, g2, b2] = hslToRgb(360, 1.0, 0.5)
        assert.strictEqual(r1, r2)
        assert.strictEqual(g1, g2)
        assert.strictEqual(b1, b2)
    })

    test('returns array of 3 integers', () => {
        const result = hslToRgb(180, 0.5, 0.5)
        assert.ok(Array.isArray(result))
        assert.strictEqual(result.length, 3)
        result.forEach(val => {
            assert.strictEqual(val, Math.floor(val))
            assert.ok(val >= 0 && val <= 255)
        })
    })
})
