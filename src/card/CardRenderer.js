import { Matrix4 } from '../math/Matrix4.js'
import { CONFIG } from '../config.js'

const TEXTURE_BINDINGS = [
    { slot: 0, name: 'base', uniform: 'u_baseTexture' },
    { slot: 1, name: 'rainbow', uniform: 'u_rainbowGradient' },
    { slot: 2, name: 'noise', uniform: 'u_noiseTexture' },
    { slot: 3, name: 'foil', uniform: 'u_foilPattern' },
    { slot: 4, name: 'depth', uniform: 'u_depthMap' },
    { slot: 5, name: 'effectMask', uniform: 'u_effectMask' },
    { slot: 6, name: 'text', uniform: 'u_textTexture' },
    { slot: 7, name: 'number', uniform: 'u_numberTexture' },
    { slot: 8, name: 'collection', uniform: 'u_collectionTexture' }
]

// Map of which textures each shader actually uses (for conditional binding)
const SHADER_TEXTURES = {
    'base': ['base', 'effectMask', 'text', 'number', 'collection'],
    'holographic': ['base', 'rainbow', 'noise', 'effectMask', 'text', 'number', 'collection'],
    'foil': ['base', 'noise', 'foil', 'effectMask', 'text', 'number', 'collection'],
    'parallax': ['base', 'depth', 'effectMask', 'text', 'number', 'collection'],
    'cracked-ice': ['base', 'rainbow', 'noise', 'effectMask', 'text', 'number', 'collection'],
    'refractor': ['base', 'rainbow', 'noise', 'effectMask', 'text', 'number', 'collection'],
    'galaxy': ['base', 'rainbow', 'effectMask', 'text', 'number', 'collection'],
    'starburst': ['base', 'rainbow', 'noise', 'effectMask', 'text', 'number', 'collection'],
    'prizm': ['base', 'rainbow', 'noise', 'effectMask', 'text', 'number', 'collection'],
    'etched': ['base', 'rainbow', 'noise', 'depth', 'effectMask', 'text', 'number', 'collection']
}

export class CardRenderer {
    constructor(gl, geometry, shaderManager) {
        this.gl = gl
        this.geometry = geometry
        this.shaderManager = shaderManager

        this.viewMatrix = new Matrix4()
        this.projectionMatrix = new Matrix4()

        // Texture binding cache to skip redundant gl.bindTexture calls
        // Maps slot number to the currently bound texture object
        this._boundTextures = new Map()

        // Uniform cache to skip redundant uniform updates
        // Tracks last-set values to avoid unnecessary GL calls
        this._uniformCache = {
            maskActive: null,
            isBaseShader: null,
            textOpacity: null,
            effectScale: null
        }
        // Track which shader the uniform cache applies to
        this._cachedShaderName = null

        // Target: card fills configured percent of canvas height
        // With card height 1.6, FOV 45°: Z = cardHeight / (fillPercent * 2 * tan(FOV/2))
        const cardHeight = 1.6
        const fillPercent = CONFIG.card.viewportFillPercent
        const fov = Math.PI / 4
        const cameraZ = cardHeight / (fillPercent * 2 * Math.tan(fov / 2))

        this.cameraPosition = [0, 0, cameraZ]
        this.time = 0

        this.setupCamera()
    }

    setupCamera() {
        // Set up view matrix (camera looking at origin)
        this.viewMatrix.lookAt(
            this.cameraPosition[0], this.cameraPosition[1], this.cameraPosition[2],  // eye
            0, 0, 0,  // target
            0, 1, 0   // up
        )
    }

    updateProjection(aspect) {
        // Perspective projection
        const fov = Math.PI / 4  // 45 degrees
        const near = 0.1
        const far = 10.0

        this.projectionMatrix.perspective(fov, aspect, near, far)
    }

    render(card, controller, deltaTime, effectSettings = {}) {
        this.time += deltaTime

        const shader = this.shaderManager.getActive()
        if (!shader) return

        const shaderName = this.shaderManager.getActiveName()
        shader.use()

        // Invalidate uniform cache on shader switch
        if (this._cachedShaderName !== shaderName) {
            this._cachedShaderName = shaderName
            this._uniformCache.maskActive = null
            this._uniformCache.isBaseShader = null
            this._uniformCache.textOpacity = null
            this._uniformCache.effectScale = null
        }

        // Set matrices (model changes every frame, view/projection are static but cheap)
        shader.setUniformMatrix4fv('u_modelMatrix', card.getModelMatrix())
        shader.setUniformMatrix4fv('u_viewMatrix', this.viewMatrix.elements)
        shader.setUniformMatrix4fv('u_projectionMatrix', this.projectionMatrix.elements)

        // Set camera position
        shader.setUniform3f('u_cameraPosition',
            this.cameraPosition[0],
            this.cameraPosition[1],
            this.cameraPosition[2]
        )

        // Set time
        shader.setUniform1f('u_time', this.time)

        // Set mouse position (controller values directly to avoid array allocation)
        shader.setUniform2f('u_mousePosition', controller.mouseX, controller.mouseY)

        // Set card rotation
        const rotation = card.getRotation()
        shader.setUniform2f('u_cardRotation', rotation[0], rotation[1])

        // Set effect settings with caching (these change infrequently)
        const maskActiveVal = effectSettings.maskActive ? 1.0 : 0.0
        if (this._uniformCache.maskActive !== maskActiveVal) {
            shader.setUniform1f('u_maskActive', maskActiveVal)
            this._uniformCache.maskActive = maskActiveVal
        }

        const isBaseShaderVal = effectSettings.isBaseShader ? 1.0 : 0.0
        if (this._uniformCache.isBaseShader !== isBaseShaderVal) {
            shader.setUniform1f('u_isBaseShader', isBaseShaderVal)
            this._uniformCache.isBaseShader = isBaseShaderVal
        }

        const textOpacityVal = effectSettings.textOpacity ?? 0.2
        if (this._uniformCache.textOpacity !== textOpacityVal) {
            shader.setUniform1f('u_textOpacity', textOpacityVal)
            this._uniformCache.textOpacity = textOpacityVal
        }

        const effectScaleVal = effectSettings.effectScale ?? 1.0
        if (this._uniformCache.effectScale !== effectScaleVal) {
            shader.setUniform1f('u_effectScale', effectScaleVal)
            this._uniformCache.effectScale = effectScaleVal
        }

        // Set variant uniforms for parallel cards
        const variant = card.getVariant()
        const variantActive = variant ? 1.0 : 0.0
        const variantColor = variant ? (CONFIG.variants[variant] || [0, 0, 0]) : [0, 0, 0]
        shader.setUniform1f('u_variantActive', variantActive)
        shader.setUniform3f('u_variantColor', variantColor[0], variantColor[1], variantColor[2])

        // Bind only textures needed by the active shader
        const requiredTextures = SHADER_TEXTURES[shaderName] || TEXTURE_BINDINGS.map(b => b.name)

        for (const { slot, name, uniform } of TEXTURE_BINDINGS) {
            if (!requiredTextures.includes(name)) continue
            const texture = card.getTexture(name)
            if (texture) {
                // Only bind if texture changed for this slot (skip redundant GL calls)
                if (this._boundTextures.get(slot) !== texture) {
                    texture.bind(slot)
                    this._boundTextures.set(slot, texture)
                }
                shader.setUniform1i(uniform, slot)
            }
        }

        // Draw (skip unbind - VAO is rebound at start of next frame anyway)
        this.geometry.bind()
        this.geometry.draw()
    }

    /**
     * Clear the texture binding cache
     * Call this when switching to a different card or when textures change
     */
    invalidateTextureCache() {
        this._boundTextures.clear()
    }

    /**
     * Clear the uniform cache
     * Call this when shader state may have changed externally
     */
    invalidateUniformCache() {
        this._cachedShaderName = null
        this._uniformCache.maskActive = null
        this._uniformCache.isBaseShader = null
        this._uniformCache.textOpacity = null
        this._uniformCache.effectScale = null
    }
}
