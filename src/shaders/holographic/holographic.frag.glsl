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
uniform float u_showMask;
uniform float u_maskActive;
uniform float u_textOpacity;

out vec4 fragColor;

// Effect parameters
const float FRESNEL_POWER = 2.5;
const float CHROMATIC_ABERRATION = 0.008;

// Multi-layer rainbow parameters
const float RAINBOW_INTENSITY_1 = 0.5;   // Large scale rainbow
const float RAINBOW_INTENSITY_2 = 0.3;   // Medium scale rainbow
const float RAINBOW_INTENSITY_3 = 0.2;   // Fine scale rainbow

// Sparkle parameters
const float SPARKLE_DENSITY = 80.0;
const float SPARKLE_THRESHOLD = 0.92;
const float SPARKLE_INTENSITY = 1.5;

float calculateFresnel(vec3 normal, vec3 viewDir) {
    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
    return pow(fresnel, FRESNEL_POWER);
}

vec3 chromaticAberration(sampler2D tex, vec2 uv, float amount) {
    vec2 center = vec2(0.5);
    vec2 dir = uv - center;
    float dist = length(dir);
    vec2 offset = normalize(dir + 0.0001) * dist * amount;

    float r = texture(tex, uv + offset).r;
    float g = texture(tex, uv).g;
    float b = texture(tex, uv - offset).b;

    return vec3(r, g, b);
}

// Hash function for sparkle generation
float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

// Generate rainbow phase for a given scale and offset
float getRainbowPhase(vec2 uv, vec2 tilt, float lightAngle, float fresnel, float scale, float offset) {
    float phase = lightAngle * 1.0;
    phase += (uv.x * tilt.y + uv.y * tilt.x) * scale * 0.5;
    phase += fresnel * 0.15;
    phase += offset;
    return fract(phase);
}

void main() {
    float tiltMagnitude = length(u_cardRotation);
    // 0% minimum when no mask, 30% minimum when mask is active
    float minEffect = u_maskActive > 0.5 ? 0.3 : 0.0;
    float effectIntensity = minEffect + tiltMagnitude * (1.0 - minEffect);

    // Store original base color for mask blending
    vec4 originalBase = texture(u_baseTexture, v_uv);
    vec3 originalColor = originalBase.rgb;
    float alpha = originalBase.a;

    // Base color with chromatic aberration based on tilt
    float chromaAmount = CHROMATIC_ABERRATION * tiltMagnitude * 3.0;
    vec3 baseColor = chromaticAberration(u_baseTexture, v_uv, chromaAmount);

    // Sample noise texture for organic variation
    vec3 noise = texture(u_noiseTexture, v_uv * 3.0).rgb;
    float noiseValue = noise.r;

    // Calculate fresnel for edge effects
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);

    // Calculate light reflection angle
    vec3 lightDir = normalize(vec3(0.0, 0.5, 1.0));
    vec3 reflectDir = reflect(-lightDir, v_worldNormal);
    float lightAngle = max(dot(reflectDir, v_viewDirection), 0.0);

    // === MULTI-LAYER RAINBOW ===
    // Layer 1: Large scale rainbow bands
    float phase1 = getRainbowPhase(v_uv, u_cardRotation, lightAngle, fresnel, 3.0, 0.0);
    vec3 rainbow1 = texture(u_rainbowGradient, vec2(phase1, 0.5)).rgb;

    // Layer 2: Medium scale with noise distortion
    float phase2 = getRainbowPhase(v_uv, u_cardRotation, lightAngle, fresnel, 6.0, noiseValue * 0.5);
    vec3 rainbow2 = texture(u_rainbowGradient, vec2(phase2, 0.5)).rgb;

    // Layer 3: Fine scale, more responsive to tilt
    float phase3 = getRainbowPhase(v_uv, u_cardRotation * 1.5, lightAngle, fresnel, 12.0, 0.33);
    vec3 rainbow3 = texture(u_rainbowGradient, vec2(phase3, 0.5)).rgb;

    // Combine rainbow layers
    float effectStrength = smoothstep(0.0, 0.25, effectIntensity);
    effectStrength *= (0.4 + lightAngle * 0.6);

    vec3 rainbowCombined = vec3(0.0);
    rainbowCombined += rainbow1 * RAINBOW_INTENSITY_1;
    rainbowCombined += rainbow2 * RAINBOW_INTENSITY_2;
    rainbowCombined += rainbow3 * RAINBOW_INTENSITY_3;
    rainbowCombined *= effectStrength;

    // === MICRO-SPARKLE ===
    vec2 sparkleUV = v_uv * SPARKLE_DENSITY;
    vec2 sparkleCell = floor(sparkleUV);
    vec2 sparkleFract = fract(sparkleUV);

    float sparkle = 0.0;
    // Check neighboring cells for sparkles
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 cell = sparkleCell + vec2(float(x), float(y));
            float h = hash(cell);

            if (h > SPARKLE_THRESHOLD) {
                // Random position within cell
                vec2 sparklePos = vec2(hash(cell + 1.0), hash(cell + 2.0));
                float dist = length(sparkleFract - sparklePos - vec2(float(x), float(y)));

                // Sparkle visibility based on effect intensity (deterministic)
                float visibility = smoothstep(0.05, 0.3, effectIntensity);

                // Sharp sparkle falloff
                float sparkleSize = 0.08 * (0.5 + h * 0.5);
                float sparkleBright = smoothstep(sparkleSize, sparkleSize * 0.2, dist);
                sparkleBright *= visibility * SPARKLE_INTENSITY * (0.5 + h * 0.5);

                sparkle += sparkleBright;
            }
        }
    }

    // Sparkle color (white with slight rainbow tint)
    vec3 sparkleColor = mix(vec3(1.0), rainbow1, 0.3) * sparkle;

    // === TEXTURE OVERLAY ===
    // Add subtle noise texture variation to break up smooth gradients
    float textureOverlay = (noiseValue - 0.5) * 0.15 * effectStrength;

    // === HIGHLIGHT BAND ===
    float highlightPos = u_cardRotation.y * 0.5 + 0.5;
    float highlight = 1.0 - abs(v_uv.x - highlightPos) * 2.0;
    highlight = smoothstep(0.0, 1.0, highlight) * pow(lightAngle, 2.0) * 0.25;

    // === RIM LIGHTING ===
    vec3 rimColor = vec3(0.6, 0.8, 1.0);
    vec3 rim = rimColor * pow(fresnel, 2.5) * 0.4 * effectIntensity;

    // === COMBINE ALL EFFECTS ===
    vec3 holoEffect = rainbowCombined;
    holoEffect += sparkleColor;
    holoEffect += vec3(highlight);
    holoEffect += vec3(textureOverlay);

    vec3 finalColor = baseColor + holoEffect + rim;

    // Apply effect mask: blend between original and effect based on mask
    float mask = texture(u_effectMask, v_uv).r;
    // Add text to the mask (text areas get the effect)
    float textMask = texture(u_textTexture, v_uv).r;
    mask = max(mask, textMask);
    finalColor = mix(originalColor, finalColor, mask);

    // Add white overlay for text readability (opacity controlled by uniform)
    finalColor = mix(finalColor, vec3(1.0), textMask * u_textOpacity);

    // Debug: show mask (including text)
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

    // Overlay collection name (white text, no shader effects)
    float collectionAlpha = texture(u_collectionTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), collectionAlpha);

    // Alpha = mask for selective bloom (only effect regions bloom)
    fragColor = vec4(finalColor, 1.0);
}
