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

out vec4 fragColor;

// Parameters
const float NUM_LINES = 24.0;
const float LINE_SHARPNESS = 2.5;
const float RAINBOW_INTENSITY = 0.5;
const float HOTSPOT_SIZE = 12.0;
const float FRESNEL_POWER = 2.5;
const float PI = 3.14159265359;

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

    // Center point shifts slightly with tilt
    vec2 center = vec2(0.5) + tilt * 0.1;
    vec2 dir = v_uv - center;
    float angle = atan(dir.y, dir.x);
    float dist = length(dir);

    // Create radial lines that rotate with tilt
    float lineAngle = angle + tilt.y * 3.0 + tilt.x * 2.0;
    float lines = sin(lineAngle * NUM_LINES) * 0.5 + 0.5;
    lines = pow(lines, LINE_SHARPNESS);

    // Add secondary finer lines
    float fineLines = sin(lineAngle * NUM_LINES * 2.0 + PI * 0.5) * 0.5 + 0.5;
    fineLines = pow(fineLines, LINE_SHARPNESS * 1.5) * 0.3;
    lines = lines * 0.7 + fineLines;

    // Rainbow color based on angle (shifts with tilt)
    float rainbowPhase = fract(angle / (2.0 * PI) + tilt.x * 0.3 + tilt.y * 0.2);
    vec3 rainbow = texture(u_rainbowGradient, vec2(rainbowPhase, 0.5)).rgb;

    // Fade toward edges (stronger in center)
    float radialFade = 1.0 - smoothstep(0.2, 0.8, dist);

    // Central hotspot glow
    float hotspot = exp(-dist * dist * HOTSPOT_SIZE);
    hotspot *= effectIntensity * 1.5;

    // Combine line effect with rainbow
    float lineEffect = lines * radialFade;
    vec3 refractorColor = rainbow * lineEffect * RAINBOW_INTENSITY * effectIntensity;

    // Add bright center
    vec3 hotspotColor = vec3(1.0, 0.98, 0.95) * hotspot;

    // Secondary rainbow ring
    float ring = smoothstep(0.25, 0.3, dist) * smoothstep(0.45, 0.35, dist);
    vec3 ringColor = rainbow * ring * 0.3 * effectIntensity;

    // Fresnel rim
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);
    vec3 rimColor = vec3(0.6, 0.8, 1.0);
    vec3 rim = rimColor * fresnel * 0.35 * effectIntensity;

    // Light streaks (lens flare effect)
    float streak1 = pow(max(0.0, 1.0 - abs(dir.x) * 4.0), 4.0) * exp(-abs(dir.y) * 3.0);
    float streak2 = pow(max(0.0, 1.0 - abs(dir.y) * 4.0), 4.0) * exp(-abs(dir.x) * 3.0);
    float streaks = (streak1 + streak2) * effectIntensity * 0.3;

    // Combine all effects
    vec3 finalColor = baseColor;
    finalColor += refractorColor;
    finalColor += hotspotColor;
    finalColor += ringColor;
    finalColor += rim;
    finalColor += vec3(streaks);

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
