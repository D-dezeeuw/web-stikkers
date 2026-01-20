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
uniform float u_effectScale;
uniform vec3 u_variantColor;
uniform float u_variantActive;

out vec4 fragColor;

// Parameters
const float NUM_RAYS = 16.0;
const float RAY_SHARPNESS = 3.0;
const float RAY_FALLOFF = 1.8;
const float GLOW_SIZE = 10.0;
const float RAINBOW_TINT = 0.45;
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

    // Center follows the mouse (reversed direction)
    vec2 center = vec2(0.5) - vec2(tilt.y, tilt.x) * 0.4;
    vec2 dir = v_uv - center;
    float angle = atan(dir.y, dir.x);
    float dist = length(dir);

    // === PRIMARY RAYS ===
    // Rays rotate more with tilt
    float rayAngle = angle + tilt.y * 4.0 - tilt.x * 3.0;
    float rays = sin(rayAngle * NUM_RAYS) * 0.5 + 0.5;
    rays = pow(rays, RAY_SHARPNESS);

    // Rays fade with distance
    float rayFade = exp(-dist * RAY_FALLOFF);
    rays *= rayFade;

    // Add noise variation for organic look
    float noise = texture(u_noiseTexture, v_uv * 4.0).r;
    rays *= 0.7 + noise * 0.5;

    // === SECONDARY RAYS (finer) ===
    float fineRays = sin(rayAngle * NUM_RAYS * 2.0 + PI * 0.25) * 0.5 + 0.5;
    fineRays = pow(fineRays, RAY_SHARPNESS * 1.5);
    fineRays *= rayFade * 0.4;

    // === CENTRAL GLOW ===
    float glow = exp(-dist * dist * GLOW_SIZE);

    // Glow intensity (brighter core)
    float glowIntensity = 0.35 + effectIntensity * 0.6;

    // === RAINBOW TINT on rays ===
    float rainbowPhase = fract(angle / (2.0 * PI) + 0.5);
    vec3 rainbow = texture(u_rainbowGradient, vec2(rainbowPhase, 0.5)).rgb;

    // === LENS FLARE ARTIFACTS ===
    // Horizontal and vertical streaks
    float hStreak = exp(-abs(dir.y) * 8.0) * exp(-abs(dir.x) * 2.0);
    float vStreak = exp(-abs(dir.x) * 8.0) * exp(-abs(dir.y) * 2.0);
    float streaks = (hStreak + vStreak) * 0.3;

    // Secondary glow ring
    float ring = smoothstep(0.15, 0.2, dist) * smoothstep(0.35, 0.25, dist);
    ring *= 0.4;

    // === COLORS ===
    vec3 rayColor = mix(vec3(1.0, 0.98, 0.9), rainbow, RAINBOW_TINT * effectIntensity);
    vec3 glowColor = vec3(1.0, 0.95, 0.85);
    vec3 streakColor = vec3(1.0, 0.9, 0.95);

    // Fresnel rim
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);
    vec3 rimColor = vec3(1.0, 0.8, 0.6);
    vec3 rim = rimColor * fresnel * 0.3 * effectIntensity;

    // === COMBINE ===
    float totalRays = rays + fineRays;
    vec3 burstEffect = rayColor * totalRays * effectIntensity * 0.6;
    burstEffect += glowColor * glow * glowIntensity;  // Brighter core
    burstEffect += streakColor * streaks * effectIntensity * 0.5;
    burstEffect += rainbow * ring * effectIntensity * 0.8;  // More color in ring

    // Scale effect intensity (for texture-brightness mask)
    vec3 finalColor = baseColor;
    finalColor += (burstEffect + rim) * u_effectScale;

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
