/**
 * sticker - WebGL Card Shader Library
 *
 * A library for rendering collectible cards with shader effects.
 *
 * Usage:
 *
 * // Programmatic API
 * import { sticker } from './src/index.js'
 * const sticker = new sticker(canvas, { shader: 'holographic', cardSrc: 'zelda' })
 * await sticker.init()
 * sticker.start()
 *
 * // Web Component
 * import { registerstickerElement } from './src/index.js'
 * registerstickerElement()
 * // Then in HTML: <sticker-card shader="holographic" card-src="zelda"></sticker-card>
 */

// Core class
export { sticker } from './lib/sticker.js'

// Web component
export { stickerElement, registerstickerElement } from './lib/stickerElement.js'

// Utilities
export { TextureLoader } from './lib/TextureLoader.js'

// Context pool (for advanced configuration)
export { WebGLContextPool } from './lib/WebGLContextPool.js'

// Shader registry (for advanced use)
export * as ShaderRegistry from './lib/ShaderRegistry.js'

// Re-export shader names and mask names for convenience
import { sticker } from './lib/sticker.js'

export const SHADER_NAMES = sticker.shaderNames
export const MASK_NAMES = sticker.maskNames
export const BUILTIN_SOURCES = sticker.builtinSources
