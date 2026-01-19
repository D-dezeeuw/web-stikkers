import { test, describe, mock, beforeEach } from 'node:test'
import assert from 'node:assert'
import { ShaderManager } from '../../src/shaders/ShaderManager.js'

// Mock WebGL context
function createMockGL() {
    return {
        createProgram: () => ({}),
        createShader: () => ({}),
        shaderSource: () => {},
        compileShader: () => {},
        getShaderParameter: () => true,
        attachShader: () => {},
        linkProgram: () => {},
        getProgramParameter: () => true,
        useProgram: () => {},
        deleteProgram: () => {},
        deleteShader: () => {},
        VERTEX_SHADER: 35633,
        FRAGMENT_SHADER: 35632,
        COMPILE_STATUS: 35713,
        LINK_STATUS: 35714
    }
}

// Mock ShaderProgram
function createMockShader(name) {
    return {
        name,
        use: mock.fn(),
        destroy: mock.fn()
    }
}

describe('ShaderManager', () => {
    describe('constructor', () => {
        test('initializes with empty shaders map', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.ok(manager.shaders instanceof Map)
            assert.strictEqual(manager.shaders.size, 0)
        })

        test('initializes with null active shader', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.strictEqual(manager.activeShader, null)
            assert.strictEqual(manager.activeShaderName, null)
        })

        test('stores gl context reference', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.strictEqual(manager.gl, gl)
        })
    })

    describe('register', () => {
        test('adds shader to map', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader = createMockShader('test')

            manager.register('test', shader)

            assert.strictEqual(manager.shaders.size, 1)
            assert.strictEqual(manager.shaders.get('test'), shader)
        })

        test('overwrites existing shader with same name', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader1 = createMockShader('test1')
            const shader2 = createMockShader('test2')

            manager.register('test', shader1)
            manager.register('test', shader2)

            assert.strictEqual(manager.shaders.size, 1)
            assert.strictEqual(manager.shaders.get('test'), shader2)
        })

        test('registers multiple shaders', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            manager.register('a', createMockShader('a'))
            manager.register('b', createMockShader('b'))
            manager.register('c', createMockShader('c'))

            assert.strictEqual(manager.shaders.size, 3)
        })
    })

    describe('get', () => {
        test('returns registered shader', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader = createMockShader('test')

            manager.register('test', shader)

            assert.strictEqual(manager.get('test'), shader)
        })

        test('returns undefined for non-existent shader', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.strictEqual(manager.get('nonexistent'), undefined)
        })
    })

    describe('has', () => {
        test('returns true for registered shader', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            manager.register('test', createMockShader('test'))

            assert.strictEqual(manager.has('test'), true)
        })

        test('returns false for non-existent shader', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.strictEqual(manager.has('nonexistent'), false)
        })
    })

    describe('getNames', () => {
        test('returns empty array when no shaders', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.deepStrictEqual(manager.getNames(), [])
        })

        test('returns array of shader names', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            manager.register('alpha', createMockShader('alpha'))
            manager.register('beta', createMockShader('beta'))
            manager.register('gamma', createMockShader('gamma'))

            const names = manager.getNames()

            assert.ok(Array.isArray(names))
            assert.strictEqual(names.length, 3)
            assert.ok(names.includes('alpha'))
            assert.ok(names.includes('beta'))
            assert.ok(names.includes('gamma'))
        })
    })

    describe('use', () => {
        test('activates shader and calls use()', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader = createMockShader('test')

            manager.register('test', shader)
            const result = manager.use('test')

            assert.strictEqual(result, shader)
            assert.strictEqual(shader.use.mock.callCount(), 1)
        })

        test('sets active shader reference', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader = createMockShader('test')

            manager.register('test', shader)
            manager.use('test')

            assert.strictEqual(manager.activeShader, shader)
            assert.strictEqual(manager.activeShaderName, 'test')
        })

        test('returns null for non-existent shader', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            const result = manager.use('nonexistent')

            assert.strictEqual(result, null)
        })

        test('switches between shaders', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader1 = createMockShader('shader1')
            const shader2 = createMockShader('shader2')

            manager.register('shader1', shader1)
            manager.register('shader2', shader2)

            manager.use('shader1')
            assert.strictEqual(manager.activeShaderName, 'shader1')

            manager.use('shader2')
            assert.strictEqual(manager.activeShaderName, 'shader2')
        })
    })

    describe('getActive', () => {
        test('returns null when no shader active', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.strictEqual(manager.getActive(), null)
        })

        test('returns active shader after use()', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader = createMockShader('test')

            manager.register('test', shader)
            manager.use('test')

            assert.strictEqual(manager.getActive(), shader)
        })
    })

    describe('getActiveName', () => {
        test('returns null when no shader active', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            assert.strictEqual(manager.getActiveName(), null)
        })

        test('returns active shader name after use()', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            manager.register('myShader', createMockShader('myShader'))
            manager.use('myShader')

            assert.strictEqual(manager.getActiveName(), 'myShader')
        })
    })

    describe('destroy', () => {
        test('calls destroy on all shaders', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)
            const shader1 = createMockShader('shader1')
            const shader2 = createMockShader('shader2')

            manager.register('shader1', shader1)
            manager.register('shader2', shader2)
            manager.destroy()

            assert.strictEqual(shader1.destroy.mock.callCount(), 1)
            assert.strictEqual(shader2.destroy.mock.callCount(), 1)
        })

        test('clears shaders map', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            manager.register('test', createMockShader('test'))
            manager.destroy()

            assert.strictEqual(manager.shaders.size, 0)
        })

        test('resets active shader to null', () => {
            const gl = createMockGL()
            const manager = new ShaderManager(gl)

            manager.register('test', createMockShader('test'))
            manager.use('test')
            manager.destroy()

            assert.strictEqual(manager.activeShader, null)
            assert.strictEqual(manager.activeShaderName, null)
        })
    })
})
