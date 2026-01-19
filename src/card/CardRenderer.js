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
    { slot: 7, name: 'number', uniform: 'u_numberTexture' }
]

export class CardRenderer {
    constructor(gl, geometry, shaderManager) {
        this.gl = gl
        this.geometry = geometry
        this.shaderManager = shaderManager

        this.viewMatrix = new Matrix4()
        this.projectionMatrix = new Matrix4()

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

        shader.use()

        // Set matrices
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

        // Set mouse position
        const mousePos = controller.getMousePosition()
        shader.setUniform2f('u_mousePosition', mousePos[0], mousePos[1])

        // Set card rotation
        const rotation = card.getRotation()
        shader.setUniform2f('u_cardRotation', rotation[0], rotation[1])

        // Set effect settings
        shader.setUniform1f('u_showMask', effectSettings.showMask ? 1.0 : 0.0)
        shader.setUniform1f('u_maskActive', effectSettings.maskActive ? 1.0 : 0.0)
        shader.setUniform1f('u_isBaseShader', effectSettings.isBaseShader ? 1.0 : 0.0)
        shader.setUniform1f('u_textOpacity', effectSettings.textOpacity ?? 0.2)

        // Bind textures using configuration
        for (const { slot, name, uniform } of TEXTURE_BINDINGS) {
            const texture = card.getTexture(name)
            if (texture) {
                texture.bind(slot)
                shader.setUniform1i(uniform, slot)
            }
        }

        // Draw
        this.geometry.bind()
        this.geometry.draw()
        this.geometry.unbind()
    }
}
