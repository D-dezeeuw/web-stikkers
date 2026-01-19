import { test, describe } from 'node:test'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { parser, generate } from '@shaderfrog/glsl-parser'

const SHADERS_DIR = new URL('../../src/shaders/', import.meta.url)

/**
 * Helper to read shader file
 */
async function readShader(relativePath) {
    const url = new URL(relativePath, SHADERS_DIR)
    return readFile(url, 'utf-8')
}

/**
 * Parse GLSL and return AST
 * quiet: true suppresses warnings about GLSL built-ins (gl_Position, etc.)
 */
function parseGLSL(source) {
    return parser.parse(source, { quiet: true })
}

/**
 * Extract uniforms from AST
 */
function extractUniforms(ast) {
    const uniforms = []
    for (const node of ast.program) {
        if (node.type === 'declaration_statement' &&
            node.declaration?.specified_type?.qualifiers) {
            const qualifiers = node.declaration.specified_type.qualifiers
            const hasUniform = qualifiers.some(q => q.token === 'uniform')
            if (hasUniform) {
                const typeName = node.declaration.specified_type.specifier?.token
                const declarations = node.declaration.declarations || []
                for (const decl of declarations) {
                    uniforms.push({
                        name: decl.identifier?.identifier,
                        type: typeName
                    })
                }
            }
        }
    }
    return uniforms
}

/**
 * Extract attributes (in variables) from AST
 */
function extractAttributes(ast) {
    const attributes = []
    for (const node of ast.program) {
        if (node.type === 'declaration_statement' &&
            node.declaration?.specified_type?.qualifiers) {
            const qualifiers = node.declaration.specified_type.qualifiers
            const hasIn = qualifiers.some(q => q.token === 'in')
            const hasLayout = qualifiers.some(q => q.type === 'layout_qualifier')
            if (hasIn && hasLayout) {
                const typeName = node.declaration.specified_type.specifier?.token
                const declarations = node.declaration.declarations || []
                for (const decl of declarations) {
                    attributes.push({
                        name: decl.identifier?.identifier,
                        type: typeName
                    })
                }
            }
        }
    }
    return attributes
}

describe('Base Vertex Shader', () => {
    test('parses without errors', async () => {
        const source = await readShader('base/base.vert.glsl')
        const ast = parseGLSL(source)
        assert.ok(ast, 'AST should be generated')
        assert.ok(ast.program.length > 0, 'AST should have program nodes')
    })

    test('contains required uniforms', async () => {
        const source = await readShader('base/base.vert.glsl')
        const ast = parseGLSL(source)
        const uniforms = extractUniforms(ast)
        const uniformNames = uniforms.map(u => u.name)

        assert.ok(uniformNames.includes('u_modelMatrix'), 'should have u_modelMatrix')
        assert.ok(uniformNames.includes('u_viewMatrix'), 'should have u_viewMatrix')
        assert.ok(uniformNames.includes('u_projectionMatrix'), 'should have u_projectionMatrix')
        assert.ok(uniformNames.includes('u_cameraPosition'), 'should have u_cameraPosition')
    })

    test('contains required attributes', async () => {
        const source = await readShader('base/base.vert.glsl')
        const ast = parseGLSL(source)
        const attributes = extractAttributes(ast)
        const attrNames = attributes.map(a => a.name)

        assert.ok(attrNames.includes('a_position'), 'should have a_position')
        assert.ok(attrNames.includes('a_uv'), 'should have a_uv')
        assert.ok(attrNames.includes('a_normal'), 'should have a_normal')
        assert.ok(attrNames.includes('a_tangent'), 'should have a_tangent')
    })

    test('regenerates valid GLSL', async () => {
        const source = await readShader('base/base.vert.glsl')
        const ast = parseGLSL(source)
        const regenerated = generate(ast)

        // Should be able to parse the regenerated code
        const ast2 = parseGLSL(regenerated)
        assert.ok(ast2, 'Regenerated GLSL should be parseable')
    })
})

describe('Base Fragment Shader', () => {
    test('parses without errors', async () => {
        const source = await readShader('base/base.frag.glsl')
        const ast = parseGLSL(source)
        assert.ok(ast, 'AST should be generated')
    })

    test('contains required texture uniforms', async () => {
        const source = await readShader('base/base.frag.glsl')
        const ast = parseGLSL(source)
        const uniforms = extractUniforms(ast)
        const uniformNames = uniforms.map(u => u.name)

        assert.ok(uniformNames.includes('u_baseTexture'), 'should have u_baseTexture')
        assert.ok(uniformNames.includes('u_effectMask'), 'should have u_effectMask')
        assert.ok(uniformNames.includes('u_textTexture'), 'should have u_textTexture')
        assert.ok(uniformNames.includes('u_time'), 'should have u_time')
    })
})

describe('Post-processing Shaders', () => {
    test('fullscreen vertex shader parses', async () => {
        const source = await readShader('post/fullscreen.vert.glsl')
        const ast = parseGLSL(source)
        assert.ok(ast, 'AST should be generated')
    })

    test('bloom-extract fragment shader parses', async () => {
        const source = await readShader('post/bloom-extract.frag.glsl')
        const ast = parseGLSL(source)
        assert.ok(ast, 'AST should be generated')
    })

    test('kawase-down fragment shader parses', async () => {
        const source = await readShader('post/kawase-down.frag.glsl')
        const ast = parseGLSL(source)
        assert.ok(ast, 'AST should be generated')
    })

    test('kawase-up fragment shader parses', async () => {
        const source = await readShader('post/kawase-up.frag.glsl')
        const ast = parseGLSL(source)
        assert.ok(ast, 'AST should be generated')
    })
})

describe('Effect Shaders', () => {
    const effectShaders = [
        'holographic/holographic.frag.glsl',
        'foil/foil.frag.glsl',
        'parallax/parallax.frag.glsl',
        'cracked-ice/cracked-ice.frag.glsl',
        'refractor/refractor.frag.glsl',
        'galaxy/galaxy.frag.glsl',
        'starburst/starburst.frag.glsl',
        'prizm/prizm.frag.glsl',
        'etched/etched.frag.glsl'
    ]

    for (const shaderPath of effectShaders) {
        const name = shaderPath.split('/')[0]

        test(`${name} shader parses without errors`, async () => {
            const source = await readShader(shaderPath)
            const ast = parseGLSL(source)
            assert.ok(ast, `${name} AST should be generated`)
            assert.ok(ast.program.length > 0, `${name} should have program nodes`)
        })
    }
})

describe('GLSL Syntax Validation', () => {
    test('detects invalid GLSL syntax', () => {
        const invalidGLSL = `#version 300 es
            void main() {
                this is not valid glsl;
            }
        `
        assert.throws(() => parseGLSL(invalidGLSL), 'Should throw on invalid GLSL')
    })

    test('detects missing semicolon', () => {
        const missingSemicolon = `#version 300 es
            precision highp float;
            void main() {
                float x = 1.0
            }
        `
        assert.throws(() => parseGLSL(missingSemicolon), 'Should throw on missing semicolon')
    })
})
