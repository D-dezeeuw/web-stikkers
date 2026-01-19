/**
 * Stikker - WebGL Card Shader Library
 *
 * A library for rendering collectible cards with shader effects.
 *
 * Usage:
 *
 * // Programmatic API
 * import { Stikker } from './src/index.js'
 * const stikker = new Stikker(canvas, { shader: 'holographic', cardSrc: 'zelda' })
 * await stikker.init()
 * stikker.start()
 *
 * // Web Component
 * import { registerStikkerElement } from './src/index.js'
 * registerStikkerElement()
 * // Then in HTML: <stikker-card shader="holographic" card-src="zelda"></stikker-card>
 */

// Core class
export { Stikker } from './lib/Stikker.js'

// Web component
export { StikkerElement, registerStikkerElement } from './lib/StikkerElement.js'

// Utilities
export { TextureLoader } from './lib/TextureLoader.js'

// Context pool (for advanced configuration)
export { WebGLContextPool } from './lib/WebGLContextPool.js'

// Shader registry (for advanced use)
export * as ShaderRegistry from './lib/ShaderRegistry.js'

// Re-export shader names and mask names for convenience
import { Stikker } from './lib/Stikker.js'

export const SHADER_NAMES = Stikker.shaderNames
export const MASK_NAMES = Stikker.maskNames
export const BUILTIN_SOURCES = Stikker.builtinSources
