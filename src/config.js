export const CONFIG = {
    // Card display
    card: {
        viewportFillPercent: 0.85,
        aspectRatio: 5 / 8,  // width:height = 1:1.6
        maxTiltRadians: 0.35,
        rotationSmoothing: 8
    },

    // Idle animation
    idle: {
        speed: 1.5,
        amplitude: 0.15
    },

    // Demo card generation
    demo: {
        resolutionScale: 2,
        baseWidth: 250,
        baseHeight: 400
    },

    // Mask dimensions (normalized 0-1)
    masks: {
        borderThickness: 0.035,
        center: {
            left: 0.15,
            right: 0.15,
            top: 0.28,
            bottom: 0.23
        },
        artWindow: {
            left: 0.10,
            right: 0.90,
            top: 0.23,
            bottom: 0.94
        }
    },

    // Texture defaults
    textures: {
        defaultSize: 256,
        maskWidth: 256,
        maskHeight: 358
    }
}
