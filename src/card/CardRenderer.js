import { Matrix4 } from '../math/Matrix4.js'

export class CardRenderer {
    constructor(gl, geometry, shaderManager) {
        this.gl = gl
        this.geometry = geometry
        this.shaderManager = shaderManager

        this.viewMatrix = new Matrix4()
        this.projectionMatrix = new Matrix4()

        // Target: card fills ~85% of canvas height
        // With card height 1.6, FOV 45°: Z = cardHeight / (fillPercent * 2 * tan(FOV/2))
        const cardHeight = 1.6
        const fillPercent = 0.85
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
        shader.setUniform1f('u_hdrEnabled', effectSettings.hdrEnabled ? 1.0 : 0.0)
        shader.setUniform1f('u_saturationBoost', effectSettings.saturationBoostEnabled ? 1.0 : 0.0)
        shader.setUniform1f('u_showMask', effectSettings.showMask ? 1.0 : 0.0)
        shader.setUniform1f('u_maskActive', effectSettings.maskActive ? 1.0 : 0.0)
        shader.setUniform1f('u_isBaseShader', effectSettings.isBaseShader ? 1.0 : 0.0)

        // Bind textures
        const baseTexture = card.getTexture('base')
        if (baseTexture) {
            baseTexture.bind(0)
            shader.setUniform1i('u_baseTexture', 0)
        }

        const rainbowTexture = card.getTexture('rainbow')
        if (rainbowTexture) {
            rainbowTexture.bind(1)
            shader.setUniform1i('u_rainbowGradient', 1)
        }

        const noiseTexture = card.getTexture('noise')
        if (noiseTexture) {
            noiseTexture.bind(2)
            shader.setUniform1i('u_noiseTexture', 2)
        }

        const foilTexture = card.getTexture('foil')
        if (foilTexture) {
            foilTexture.bind(3)
            shader.setUniform1i('u_foilPattern', 3)
        }

        const depthTexture = card.getTexture('depth')
        if (depthTexture) {
            depthTexture.bind(4)
            shader.setUniform1i('u_depthMap', 4)
        }

        const effectMask = card.getTexture('effectMask')
        if (effectMask) {
            effectMask.bind(5)
            shader.setUniform1i('u_effectMask', 5)
        }

        const textTexture = card.getTexture('text')
        if (textTexture) {
            textTexture.bind(6)
            shader.setUniform1i('u_textTexture', 6)
        }

        const numberTexture = card.getTexture('number')
        if (numberTexture) {
            numberTexture.bind(7)
            shader.setUniform1i('u_numberTexture', 7)
        }

        // Draw
        this.geometry.bind()
        this.geometry.draw()
        this.geometry.unbind()
    }
}
