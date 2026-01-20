#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_viewDirection;
in vec3 v_tangentViewDir;
in float v_depth;

uniform sampler2D u_baseTexture;
uniform sampler2D u_depthMap;
uniform sampler2D u_effectMask;
uniform sampler2D u_textTexture;
uniform sampler2D u_numberTexture;
uniform sampler2D u_collectionTexture;
uniform float u_time;
uniform vec2 u_mousePosition;
uniform vec2 u_cardRotation;
uniform float u_textOpacity;

out vec4 fragColor;

// Hash functions for procedural generation
float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Generate a star field layer
float starLayer(vec2 uv, float density, float seed, float starSize) {
    float stars = 0.0;

    // Grid-based star placement
    vec2 gridUV = uv * density;
    vec2 cellId = floor(gridUV);
    vec2 cellUV = fract(gridUV);

    // Check current cell and neighbors for stars
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 id = cellId + neighbor;

            // Random position within cell
            float h = hash(id + seed);
            float h2 = hash2(id + seed * 2.0);

            // More stars (lower threshold)
            if (h > 0.55) {
                vec2 starPos = neighbor + vec2(hash(id + seed + 1.0), hash(id + seed + 2.0)) * 0.8 + 0.1;
                float dist = length(cellUV - starPos);

                // Star brightness with smooth falloff
                float size = starSize * (0.6 + h2 * 0.4);
                float brightness = smoothstep(size, size * 0.05, dist);

                // Add twinkle variation based on position
                brightness *= 0.8 + 0.2 * h2;

                stars += brightness;
            }
        }
    }

    return stars;
}

// Star layer parameters - 7 layers
const int NUM_LAYERS = 7;

// Minimum effect visibility (30%)
const float MIN_EFFECT = 0.3;

void main() {
    // Get base card texture (no parallax on this)
    vec4 baseColor = texture(u_baseTexture, v_uv);
    vec3 originalColor = baseColor.rgb;  // Store for mask blending

    // Tilt vector for parallax
    vec2 tilt = u_cardRotation;
    float tiltMagnitude = length(tilt);
    float effectIntensity = MIN_EFFECT + tiltMagnitude * (1.0 - MIN_EFFECT);

    // Star layer configuration - 7 layers
    // Parallax range: -0.40 to +0.20
    float parallaxStrengths[7];
    parallaxStrengths[0] = -0.40;  // Far back
    parallaxStrengths[1] = -0.30;
    parallaxStrengths[2] = -0.20;
    parallaxStrengths[3] = -0.10;
    parallaxStrengths[4] =  0.00;  // Middle (stationary)
    parallaxStrengths[5] =  0.10;
    parallaxStrengths[6] =  0.20;  // Front

    // Density: back layers sparser, middle denser
    float densities[7];
    densities[0] = 10.0;
    densities[1] = 14.0;
    densities[2] = 18.0;
    densities[3] = 22.0;
    densities[4] = 25.0;
    densities[5] = 22.0;
    densities[6] = 18.0;

    // Sizes: back small, front large
    float sizes[7];
    sizes[0] = 0.05;
    sizes[1] = 0.06;
    sizes[2] = 0.07;
    sizes[3] = 0.08;
    sizes[4] = 0.09;
    sizes[5] = 0.10;
    sizes[6] = 0.12;

    // Brightness range: 0.5 to 1.25
    float brightnesses[7];
    brightnesses[0] = 0.50;
    brightnesses[1] = 0.625;
    brightnesses[2] = 0.75;
    brightnesses[3] = 0.875;
    brightnesses[4] = 1.0;
    brightnesses[5] = 1.125;
    brightnesses[6] = 1.25;

    // Color tints (back=blue, front=warm)
    vec3 colors[7];
    colors[0] = vec3(0.4, 0.5, 1.0);   // Deep blue (far back)
    colors[1] = vec3(0.5, 0.6, 1.0);
    colors[2] = vec3(0.6, 0.7, 1.0);
    colors[3] = vec3(0.75, 0.8, 1.0);
    colors[4] = vec3(0.9, 0.9, 1.0);   // White (middle)
    colors[5] = vec3(1.0, 0.95, 0.9);
    colors[6] = vec3(1.0, 0.9, 0.8);   // Warm (front)

    // Accumulate stars from all layers
    vec3 starColor = vec3(0.0);

    for (int i = 0; i < NUM_LAYERS; i++) {
        // Apply parallax offset to UV
        // Swap axes: tilt.y (horizontal mouse) -> uv.x, tilt.x (vertical mouse) -> uv.y
        vec2 offsetUV = v_uv + vec2(tilt.y, tilt.x) * parallaxStrengths[i];

        // Generate stars for this layer
        float stars = starLayer(offsetUV, densities[i], float(i) * 100.0, sizes[i]);

        // Add colored stars
        starColor += stars * brightnesses[i] * colors[i];
    }

    // Fresnel rim effect for depth
    float fresnel = 1.0 - max(dot(v_worldNormal, v_viewDirection), 0.0);
    fresnel = pow(fresnel, 2.5);
    vec3 rimGlow = vec3(0.3, 0.4, 0.8) * fresnel * 0.5 * effectIntensity;

    // Combine: base texture + stars + rim
    vec3 finalColor = baseColor.rgb;
    finalColor += starColor;
    finalColor += rimGlow;

    // Slight vignette to frame the effect
    float vignette = 1.0 - length(v_uv - 0.5) * 0.25;
    finalColor *= vignette;

    // Apply effect mask: blend between original and effect based on mask
    float mask = texture(u_effectMask, v_uv).r;
    // Add text to the mask (text areas get the effect)
    float textMask = texture(u_textTexture, v_uv).r;
    mask = max(mask, textMask);
    finalColor = mix(originalColor, finalColor, mask);

    // Add white overlay for text readability (opacity controlled by uniform)
    finalColor = mix(finalColor, vec3(1.0), textMask * u_textOpacity);

    // Overlay number (white text, no shader effects)
    float numberAlpha = texture(u_numberTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), numberAlpha);

    // Overlay collection name (white text, no shader effects)
    float collectionAlpha = texture(u_collectionTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), collectionAlpha);

    // Alpha = mask for selective bloom (only effect regions bloom)
    fragColor = vec4(finalColor, 1.0);
}
