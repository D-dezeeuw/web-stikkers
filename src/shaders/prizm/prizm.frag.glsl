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
uniform float u_time;
uniform vec2 u_mousePosition;
uniform vec2 u_cardRotation;
uniform float u_hdrEnabled;
uniform float u_saturationBoost;
uniform float u_showMask;

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

    // HDR + Tonemap (ACES filmic)
    if (u_hdrEnabled > 0.5) {
        vec3 hdr = finalColor * (1.0 + finalColor * 0.5);
        vec3 a = hdr * (hdr + 0.0245786) - 0.000090537;
        vec3 b = hdr * (0.983729 * hdr + 0.4329510) + 0.238081;
        finalColor = a / b;
        float brightness = dot(finalColor, vec3(0.299, 0.587, 0.114));
        float glow = smoothstep(0.5, 1.0, brightness) * 0.15;
        finalColor += finalColor * glow;
    }

    // Saturation boost
    if (u_saturationBoost > 0.5) {
        vec3 gray = vec3(dot(finalColor, vec3(0.299, 0.587, 0.114)));
        finalColor = mix(gray, finalColor, 1.5);
    }

    // Debug: show mask
    if (u_showMask > 0.5) {
        float maskValue = texture(u_effectMask, v_uv).r;
        float textValue = texture(u_textTexture, v_uv).r;
        maskValue = max(maskValue, textValue);
        fragColor = vec4(vec3(maskValue), alpha);
        return;
    }

    // Overlay number (white text, no shader effects)
    float numberAlpha = texture(u_numberTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), numberAlpha);

    fragColor = vec4(finalColor, alpha);
}
