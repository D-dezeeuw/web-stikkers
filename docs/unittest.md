# Unit Testing Coverage Report

## Summary

**186 tests** | **~1 second runtime** | **56.9% line coverage**

This document explains the unit testing strategy and why certain code cannot be covered by pure unit tests.

## Coverage by File

| File | Line % | Branch % | Funcs % | Testable |
|------|--------|----------|---------|----------|
| `src/math/Vector3.js` | 100% | 100% | 100% | ✅ Pure |
| `src/math/Matrix4.js` | 100% | 100% | 100% | ✅ Pure |
| `src/card/Card.js` | 100% | 100% | 100% | ✅ Pure |
| `src/config.js` | 100% | 100% | 100% | ✅ Pure |
| `src/shaders/ShaderManager.js` | 85.7% | 100% | 90% | ⚠️ Partial |
| `src/core/ProceduralTextures.js` | 31.6% | 100% | 42.9% | ⚠️ Partial |
| `src/core/MaskFactory.js` | 14.4% | 100% | 12.5% | ⚠️ Partial |
| `src/core/ShaderProgram.js` | 23.3% | 100% | 0% | ❌ WebGL |
| `src/core/Texture.js` | 13.8% | 100% | 0% | ❌ WebGL |
| `src/utils/ShaderLoader.js` | 17.4% | 100% | 0% | ❌ Fetch API |

## Testability Categories

### ✅ Fully Testable (Pure Functions)

These modules have **no external dependencies** and can be unit tested completely:

| Module | What's Tested |
|--------|---------------|
| `Vector3.js` | All 13 methods: constructor, set, copy, clone, add, sub, multiplyScalar, dot, cross, length, normalize, lerp, toArray |
| `Matrix4.js` | All 17 methods: identity, copy, clone, multiply, translate, rotate*, scale, perspective, orthographic, lookAt, invert, transpose |
| `Card.js` | All methods: constructor, setTargetRotation, update, lerp, getRotation, getTiltMagnitude, get/setTexture, updateModelMatrix, getModelMatrix |
| `config.js` | Structure validation, value range checks, type assertions |

### ⚠️ Partially Testable

These modules contain **both pure functions and WebGL-dependent code**:

#### `ProceduralTextures.js`
| Function | Testable | Reason |
|----------|----------|--------|
| `seededRandom(seed)` | ✅ Yes | Pure math |
| `hslToRgb(h, s, l)` | ✅ Yes | Pure color conversion |
| `createRainbowGradient(gl, size)` | ❌ No | Creates WebGL texture |
| `createNoiseTexture(gl, size)` | ❌ No | Creates WebGL texture |
| `createFoilPattern(gl, size)` | ❌ No | Creates WebGL texture |
| `createDepthMap(gl, w, h)` | ❌ No | Creates WebGL texture |

#### `MaskFactory.js`
| Function | Testable | Reason |
|----------|----------|--------|
| `smoothstep(edge0, edge1, x)` | ✅ Yes | Pure math |
| `createFullMask(gl, w, h)` | ❌ No | Creates WebGL texture |
| `createBorderMask(gl, w, h)` | ❌ No | Creates WebGL texture |
| `createCenterMask(gl, w, h)` | ❌ No | Creates WebGL texture |
| `createArtWindowMask(gl, w, h)` | ❌ No | Creates WebGL texture |
| `createTextureBrightnessMask(gl, canvas)` | ❌ No | Canvas + WebGL |
| `createRadialEdgeMask(gl, w, h)` | ❌ No | Creates WebGL texture |
| `createRadialCenterMask(gl, w, h)` | ❌ No | Creates WebGL texture |

#### `ShaderManager.js`
| Function | Testable | Reason |
|----------|----------|--------|
| `constructor(gl)` | ✅ Yes | Just initializes Map |
| `register(name, program)` | ✅ Yes | Map.set() |
| `get(name)` | ✅ Yes | Map.get() |
| `has(name)` | ✅ Yes | Map.has() |
| `getNames()` | ✅ Yes | Array.from(Map.keys()) |
| `getActive()` | ✅ Yes | Returns reference |
| `getActiveName()` | ✅ Yes | Returns string |
| `use(name)` | ⚠️ Partial | Calls shader.use() (WebGL) |
| `destroy()` | ⚠️ Partial | Calls shader.destroy() (WebGL) |
| `loadShader(name, vPath, fPath)` | ❌ No | Async fetch + WebGL compilation |

### ❌ Not Unit Testable (External Dependencies)

These modules **require browser/WebGL APIs** that cannot run in Node.js:

#### `ShaderProgram.js`
**Requires:** WebGL 2.0 context

All methods call WebGL API directly:
- `gl.createProgram()`, `gl.createShader()`
- `gl.shaderSource()`, `gl.compileShader()`
- `gl.attachShader()`, `gl.linkProgram()`
- `gl.getUniformLocation()`, `gl.uniform*()`

#### `Texture.js`
**Requires:** WebGL 2.0 context + DOM Image API

- `gl.createTexture()`, `gl.bindTexture()`
- `gl.texImage2D()`, `gl.generateMipmap()`
- `new Image()` for loading

#### `Geometry.js`
**Requires:** WebGL 2.0 context

- `gl.createVertexArray()`, `gl.createBuffer()`
- `gl.bindVertexArray()`, `gl.bufferData()`
- `gl.drawElements()`

#### `WebGLContext.js`
**Requires:** HTML Canvas element + WebGL 2.0

- `canvas.getContext('webgl2')`
- All WebGL state configuration

#### `ShaderLoader.js`
**Requires:** Fetch API (browser or polyfill)

- `fetch()` for loading .glsl files
- Recursive include resolution

#### `CardRenderer.js`, `BloomPass.js`, `EffectsPass.js`
**Requires:** Full WebGL pipeline

- Framebuffer operations
- Multi-pass rendering
- Shader uniform binding

#### `CardController.js`, `MouseTracker.js`
**Requires:** DOM APIs

- `addEventListener()` for mouse/touch events
- `getBoundingClientRect()` for coordinates

#### `CardFactory.js`, `TextRenderer.js`
**Requires:** Canvas 2D + WebGL + DOM

- `canvas.getContext('2d')` for text/image rendering
- `new Image()` for asset loading
- WebGL texture creation

## Why Not Mock WebGL?

Mocking WebGL for unit tests is possible but **not recommended** because:

1. **Complexity**: WebGL has 300+ methods with complex state interactions
2. **False Confidence**: Mocks don't catch real GPU driver issues
3. **Maintenance Burden**: Mock must be updated with every WebGL usage change
4. **Redundancy**: Playwright already tests real WebGL in the browser

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     Testing Pyramid                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│     ┌─────────────────┐                                     │
│     │   Playwright    │  E2E / Integration                  │
│     │   (Browser)     │  - Real WebGL rendering             │
│     │                 │  - Visual regression                │
│     └────────┬────────┘  - User interaction                 │
│              │                                               │
│     ┌────────┴────────┐                                     │
│     │   node:test     │  Unit Tests                         │
│     │   (Node.js)     │  - Pure functions (math, state)     │
│     │                 │  - GLSL syntax validation           │
│     │                 │  - Config validation                │
│     └─────────────────┘                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Unit Tests (node:test) - Fast, Isolated
```bash
npm run test:unit           # ~1 second
npm run test:unit:coverage  # With coverage report
npm run test:unit:watch     # Watch mode
```

**Covers:**
- Math utilities (Vector3, Matrix4)
- Card state management
- Configuration validation
- GLSL shader syntax (via glsl-parser)
- Pure helper functions

### Integration Tests (Playwright) - Real Browser
```bash
npm run test                # Full browser tests
npm run test:headed         # With visible browser
```

**Covers:**
- WebGL shader compilation
- Texture loading and rendering
- Visual output verification
- User interaction (mouse, touch)

## Test Files

```
tests/
└── unit/
    ├── math.test.js              # Vector3, Matrix4
    ├── card.test.js              # Card class
    ├── config.test.js            # CONFIG validation
    ├── procedural-textures.test.js  # seededRandom, hslToRgb
    ├── mask-factory.test.js      # smoothstep
    ├── shader-manager.test.js    # Map operations (mocked)
    └── shaders.test.js           # GLSL syntax validation
```

## Running Tests

```bash
# Unit tests only (fast)
npm run test:unit

# Unit tests with coverage
npm run test:unit:coverage

# Unit tests in watch mode
npm run test:unit:watch

# All tests (unit + Playwright)
npm run test:unit && npm run test
```

## Conclusion

The **56.9% line coverage** represents the maximum achievable through pure unit testing without mocking browser APIs. The remaining code is covered by Playwright integration tests which run in a real browser with actual WebGL support.

This split provides:
- **Fast feedback** during development (unit tests in ~1s)
- **Real validation** of WebGL rendering (Playwright)
- **No false confidence** from over-mocked tests
