#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_viewDirection;
in vec3 v_tangentViewDir;
in float v_depth;

uniform sampler2D u_baseTexture;
uniform sampler2D u_rainbowGradient;
uniform sampler2D u_noiseTexture;
uniform sampler2D u_effectMask;
uniform sampler2D u_textTexture;
uniform sampler2D u_numberTexture;
uniform sampler2D u_collectionTexture;
uniform float u_time;
uniform vec2 u_mousePosition;
uniform vec2 u_cardRotation;
uniform float u_textOpacity;
uniform vec3 u_variantColor;
uniform float u_variantActive;

out vec4 fragColor;

// Parameters
const float GRID_SIZE = 10.0;
const float COLOR_INTENSITY = 0.55;
const float EDGE_WIDTH = 0.03;
const float FACET_VARIATION = 0.4;
const float SPECULAR_POWER = 24.0;
const float FRESNEL_POWER = 2.5;

// Hash function
float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float calculateFresnel(vec3 normal, vec3 viewDir) {
    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
    return pow(fresnel, FRESNEL_POWER);
}

// Minimum effect visibility (30%)
const float MIN_EFFECT = 0.3;

void main() {
    vec4 baseTexture = texture(u_baseTexture, v_uv);
    vec3 baseColor = baseTexture.rgb;
    vec3 originalColor = baseColor;  // Store for mask blending
    float alpha = baseTexture.a;

    float tiltMagnitude = length(u_cardRotation);
    float effectIntensity = MIN_EFFECT + tiltMagnitude * (1.0 - MIN_EFFECT);
    vec2 tilt = u_cardRotation;

    // === TRIANGLE GRID ===
    vec2 scaled = v_uv * GRID_SIZE;
    vec2 cell = floor(scaled);
    vec2 local = fract(scaled);

    // Determine which triangle (upper-left or lower-right of cell)
    bool upperTriangle = local.x + local.y < 1.0;

    // Unique ID for each triangle
    float triangleId = hash(cell) + (upperTriangle ? 0.0 : 0.5);
    triangleId = fract(triangleId * 1.7);

    // === FACET COLOR ===
    // Each triangle gets a unique rainbow phase that shifts with tilt
    float phase = fract(triangleId + tilt.x * 1.5 + tilt.y * 1.5);
    vec3 prizmColor = texture(u_rainbowGradient, vec2(phase, 0.5)).rgb;

    // === FACET LIGHTING ===
    // Each triangle has a slightly perturbed normal
    vec3 facetNormal = normalize(vec3(
        (hash(cell + 0.1) - 0.5) * FACET_VARIATION,
        (hash(cell + 0.2) - 0.5) * FACET_VARIATION,
        1.0
    ));

    // Light direction based on tilt
    vec3 lightDir = normalize(vec3(tilt.y * 2.0, -tilt.x * 2.0 + 0.5, 1.0));

    // Diffuse lighting per facet
    float diffuse = max(dot(facetNormal, lightDir), 0.0);

    // Specular highlight per facet
    vec3 reflectDir = reflect(-lightDir, facetNormal);
    float spec = pow(max(dot(reflectDir, v_viewDirection), 0.0), SPECULAR_POWER);
    spec *= effectIntensity;

    // === EDGE DETECTION ===
    // Distance to nearest triangle edge
    float edge;
    if (upperTriangle) {
        // Upper triangle: edges at x=0, y=0, x+y=1
        edge = min(local.x, min(local.y, 1.0 - local.x - local.y));
    } else {
        // Lower triangle: edges at x=1, y=1, x+y=1
        edge = min(1.0 - local.x, min(1.0 - local.y, local.x + local.y - 1.0));
    }
    float edgeMask = smoothstep(0.0, EDGE_WIDTH, edge);

    // Edge glow
    float edgeGlow = (1.0 - edgeMask) * 0.5 * effectIntensity;

    // === COMBINE ===
    // Mix base color with prizm color based on effect
    vec3 facetColor = mix(baseColor, prizmColor, COLOR_INTENSITY * effectIntensity);

    // Apply lighting
    facetColor *= 0.6 + diffuse * 0.5;
    facetColor += vec3(spec * 0.5);

    // Darken edges slightly
    facetColor *= 0.85 + edgeMask * 0.15;

    // Add edge glow
    vec3 edgeColor = vec3(0.9, 0.95, 1.0);
    facetColor += edgeColor * edgeGlow;

    // Fresnel rim
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);
    vec3 rimColor = vec3(0.6, 0.8, 1.0);
    vec3 rim = rimColor * fresnel * 0.35 * effectIntensity;

    vec3 finalColor = facetColor + rim;

    // Apply effect mask: blend between original and effect based on mask
    float mask = texture(u_effectMask, v_uv).r;
    // Add text to the mask (text areas get the effect)
    float textMask = texture(u_textTexture, v_uv).r;
    mask = max(mask, textMask);
    finalColor = mix(originalColor, finalColor, mask);

    // Apply variant color: stronger tint (40%) + solid overlay (10%)
    vec3 tintedColor = mix(finalColor, finalColor * u_variantColor, 0.4);
    vec3 overlayColor = mix(tintedColor, u_variantColor, 0.1);
    finalColor = mix(finalColor, overlayColor, u_variantActive * mask);

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
