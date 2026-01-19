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
uniform sampler2D u_depthMap;
uniform sampler2D u_effectMask;
uniform sampler2D u_textTexture;
uniform sampler2D u_numberTexture;
uniform float u_time;
uniform vec2 u_mousePosition;
uniform vec2 u_cardRotation;
uniform float u_showMask;
uniform float u_textOpacity;

out vec4 fragColor;

// Parameters
const float MATTE_FACTOR = 0.55;
const float METALLIC_SPEC_POWER = 64.0;
const float EMBOSS_STRENGTH = 0.7;
const float PATTERN_SCALE = 25.0;
const float FRESNEL_POWER = 2.0;

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

    // === ETCH MASK ===
    // Use depth map for etched areas (bright = metallic, dark = matte)
    float depthMask = texture(u_depthMap, v_uv).r;

    // Also add a procedural pattern (grid of dots/lines)
    float patternX = sin(v_uv.x * PATTERN_SCALE * 3.14159) * 0.5 + 0.5;
    float patternY = sin(v_uv.y * PATTERN_SCALE * 3.14159) * 0.5 + 0.5;
    float dots = patternX * patternY;
    dots = smoothstep(0.3, 0.7, dots);

    // Combine masks: depth map + pattern
    float etchMask = max(depthMask, dots * 0.5);
    etchMask = smoothstep(0.3, 0.7, etchMask);

    // === MATTE AREAS ===
    // Reduced brightness, no specular, grainy texture
    float noise = texture(u_noiseTexture, v_uv * 8.0).r;
    vec3 matteColor = baseColor * MATTE_FACTOR;
    matteColor *= 0.85 + noise * 0.2; // More visible texture variation
    // Desaturate matte areas slightly for more contrast
    float matteLuma = dot(matteColor, vec3(0.299, 0.587, 0.114));
    matteColor = mix(matteColor, vec3(matteLuma), 0.25);

    // === METALLIC AREAS ===
    // Light direction
    vec3 lightDir = normalize(vec3(
        tilt.y * 2.0 + 0.2,
        -tilt.x * 2.0 + 0.4,
        1.0
    ));

    // Specular highlight
    vec3 halfVec = normalize(lightDir + v_viewDirection);
    float spec = pow(max(dot(v_worldNormal, halfVec), 0.0), METALLIC_SPEC_POWER);

    // Metallic color (bright, with specular)
    vec3 metallicColor = baseColor * 1.4;
    metallicColor += vec3(spec * 1.2 * effectIntensity);

    // Strong color shift on metallic areas
    float colorShift = tilt.x * 0.2 + tilt.y * 0.2;
    metallicColor *= 1.0 + vec3(colorShift, colorShift * 0.5, -colorShift) * effectIntensity * 1.5;

    // === EMBOSS EFFECT ===
    // Sample neighboring pixels to create beveled edge look
    float texelSize = 1.0 / 512.0;
    float maskLeft = texture(u_depthMap, v_uv - vec2(texelSize, 0.0)).r;
    float maskRight = texture(u_depthMap, v_uv + vec2(texelSize, 0.0)).r;
    float maskUp = texture(u_depthMap, v_uv - vec2(0.0, texelSize)).r;
    float maskDown = texture(u_depthMap, v_uv + vec2(0.0, texelSize)).r;

    // Emboss gradient
    float embossX = (maskRight - maskLeft) * EMBOSS_STRENGTH;
    float embossY = (maskDown - maskUp) * EMBOSS_STRENGTH;

    // Light emboss based on tilt
    float embossLight = embossX * tilt.y + embossY * (-tilt.x);
    embossLight *= effectIntensity * 2.0;

    // === FRESNEL RIM ===
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);

    // Metallic areas get more rim effect
    vec3 rimColor = vec3(0.8, 0.85, 1.0);
    vec3 rim = rimColor * fresnel * 0.7 * effectIntensity * etchMask;

    // === COMBINE ===
    vec3 finalColor = mix(matteColor, metallicColor, etchMask);

    // Add emboss lighting
    finalColor += vec3(embossLight * 0.5);

    // Add rim
    finalColor += rim;

    // Slight vignette
    float vignette = 1.0 - length(v_uv - 0.5) * 0.15;
    finalColor *= vignette;

    // Apply effect mask: blend between original and effect based on mask
    float mask = texture(u_effectMask, v_uv).r;
    // Add text to the mask (text areas get the effect)
    float textMask = texture(u_textTexture, v_uv).r;
    mask = max(mask, textMask);
    finalColor = mix(originalColor, finalColor, mask);

    // Add white overlay for text readability (opacity controlled by uniform)
    finalColor = mix(finalColor, vec3(1.0), textMask * u_textOpacity);

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

    // Alpha = mask for selective bloom (only effect regions bloom)
    fragColor = vec4(finalColor, 1.0);
}
