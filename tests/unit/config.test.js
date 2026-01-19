import { test, describe } from 'node:test'
import assert from 'node:assert'
import { CONFIG } from '../../src/config.js'

describe('CONFIG', () => {
    test('exports CONFIG object', () => {
        assert.ok(CONFIG)
        assert.strictEqual(typeof CONFIG, 'object')
    })

    describe('card settings', () => {
        test('has card section', () => {
            assert.ok(CONFIG.card)
            assert.strictEqual(typeof CONFIG.card, 'object')
        })

        test('viewportFillPercent is valid percentage', () => {
            assert.strictEqual(typeof CONFIG.card.viewportFillPercent, 'number')
            assert.ok(CONFIG.card.viewportFillPercent > 0)
            assert.ok(CONFIG.card.viewportFillPercent <= 1)
        })

        test('aspectRatio is positive number', () => {
            assert.strictEqual(typeof CONFIG.card.aspectRatio, 'number')
            assert.ok(CONFIG.card.aspectRatio > 0)
        })

        test('aspectRatio matches expected 5:8 ratio', () => {
            assert.strictEqual(CONFIG.card.aspectRatio, 5 / 8)
        })

        test('maxTiltRadians is reasonable', () => {
            assert.strictEqual(typeof CONFIG.card.maxTiltRadians, 'number')
            assert.ok(CONFIG.card.maxTiltRadians > 0)
            assert.ok(CONFIG.card.maxTiltRadians < Math.PI / 2) // Less than 90 degrees
        })

        test('rotationSmoothing is positive', () => {
            assert.strictEqual(typeof CONFIG.card.rotationSmoothing, 'number')
            assert.ok(CONFIG.card.rotationSmoothing > 0)
        })
    })

    describe('idle animation settings', () => {
        test('has idle section', () => {
            assert.ok(CONFIG.idle)
            assert.strictEqual(typeof CONFIG.idle, 'object')
        })

        test('speed is positive', () => {
            assert.strictEqual(typeof CONFIG.idle.speed, 'number')
            assert.ok(CONFIG.idle.speed > 0)
        })

        test('amplitude is reasonable', () => {
            assert.strictEqual(typeof CONFIG.idle.amplitude, 'number')
            assert.ok(CONFIG.idle.amplitude > 0)
            assert.ok(CONFIG.idle.amplitude < 1) // Should be subtle
        })
    })

    describe('demo settings', () => {
        test('has demo section', () => {
            assert.ok(CONFIG.demo)
            assert.strictEqual(typeof CONFIG.demo, 'object')
        })

        test('resolutionScale is positive integer', () => {
            assert.strictEqual(typeof CONFIG.demo.resolutionScale, 'number')
            assert.ok(CONFIG.demo.resolutionScale >= 1)
            assert.strictEqual(CONFIG.demo.resolutionScale, Math.floor(CONFIG.demo.resolutionScale))
        })

        test('baseWidth is positive', () => {
            assert.strictEqual(typeof CONFIG.demo.baseWidth, 'number')
            assert.ok(CONFIG.demo.baseWidth > 0)
        })

        test('baseHeight is positive', () => {
            assert.strictEqual(typeof CONFIG.demo.baseHeight, 'number')
            assert.ok(CONFIG.demo.baseHeight > 0)
        })

        test('baseHeight > baseWidth (portrait orientation)', () => {
            assert.ok(CONFIG.demo.baseHeight > CONFIG.demo.baseWidth)
        })
    })

    describe('mask settings', () => {
        test('has masks section', () => {
            assert.ok(CONFIG.masks)
            assert.strictEqual(typeof CONFIG.masks, 'object')
        })

        test('borderThickness is valid normalized value', () => {
            assert.strictEqual(typeof CONFIG.masks.borderThickness, 'number')
            assert.ok(CONFIG.masks.borderThickness > 0)
            assert.ok(CONFIG.masks.borderThickness < 0.5) // Less than half
        })

        describe('center mask bounds', () => {
            test('has center section', () => {
                assert.ok(CONFIG.masks.center)
            })

            test('all bounds are normalized (0-1)', () => {
                const { left, right, top, bottom } = CONFIG.masks.center
                assert.ok(left >= 0 && left < 0.5)
                assert.ok(right >= 0 && right < 0.5)
                assert.ok(top >= 0 && top < 0.5)
                assert.ok(bottom >= 0 && bottom < 0.5)
            })

            test('bounds leave visible center area', () => {
                const { left, right, top, bottom } = CONFIG.masks.center
                assert.ok(left + right < 1, 'horizontal bounds should not overlap')
                assert.ok(top + bottom < 1, 'vertical bounds should not overlap')
            })
        })

        describe('artWindow mask bounds', () => {
            test('has artWindow section', () => {
                assert.ok(CONFIG.masks.artWindow)
            })

            test('all bounds are normalized (0-1)', () => {
                const { left, right, top, bottom } = CONFIG.masks.artWindow
                assert.ok(left >= 0 && left <= 1)
                assert.ok(right >= 0 && right <= 1)
                assert.ok(top >= 0 && top <= 1)
                assert.ok(bottom >= 0 && bottom <= 1)
            })

            test('left < right', () => {
                assert.ok(CONFIG.masks.artWindow.left < CONFIG.masks.artWindow.right)
            })

            test('top < bottom', () => {
                assert.ok(CONFIG.masks.artWindow.top < CONFIG.masks.artWindow.bottom)
            })
        })
    })

    describe('texture settings', () => {
        test('has textures section', () => {
            assert.ok(CONFIG.textures)
            assert.strictEqual(typeof CONFIG.textures, 'object')
        })

        test('defaultSize is power of 2', () => {
            const size = CONFIG.textures.defaultSize
            assert.strictEqual(typeof size, 'number')
            assert.ok(size > 0)
            assert.strictEqual(Math.log2(size) % 1, 0, 'should be power of 2')
        })

        test('maskWidth is power of 2', () => {
            const size = CONFIG.textures.maskWidth
            assert.strictEqual(typeof size, 'number')
            assert.ok(size > 0)
            assert.strictEqual(Math.log2(size) % 1, 0, 'should be power of 2')
        })

        test('maskHeight is positive', () => {
            assert.strictEqual(typeof CONFIG.textures.maskHeight, 'number')
            assert.ok(CONFIG.textures.maskHeight > 0)
        })

        test('mask dimensions have reasonable aspect ratio', () => {
            const aspectRatio = CONFIG.textures.maskWidth / CONFIG.textures.maskHeight
            // Mask should be portrait orientation (width < height)
            assert.ok(aspectRatio < 1, 'mask should be portrait orientation')
            assert.ok(aspectRatio > 0.5, 'mask should not be too narrow')
        })
    })
})
