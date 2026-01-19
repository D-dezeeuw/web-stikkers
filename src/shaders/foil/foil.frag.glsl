#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_viewDirection;
in vec3 v_tangentViewDir;
in float v_depth;

uniform sampler2D u_baseTexture;
uniform sampler2D u_foilPattern;
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

// Effect parameters
const float SPECULAR_POWER = 64.0;
const float SPARKLE_INTENSITY = 1.2;
const float SPARKLE_THRESHOLD = 0.85;

float calculateSpecular(vec3 normal, vec3 viewDir, vec3 lightDir) {
    vec3 halfVec = normalize(lightDir + viewDir);
    float spec = max(dot(normal, halfVec), 0.0);
    return pow(spec, SPECULAR_POWER);
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

    // Light direction influenced by card tilt (simulates environment reflection)
    vec3 lightDir = normalize(vec3(
        u_cardRotation.y * 2.0 + 0.3,
        -u_cardRotation.x * 2.0 + 0.5,
        1.0
    ));

    // Main specular highlight
    float spec = calculateSpecular(v_worldNormal, v_viewDirection, lightDir);

    // Sparkle pattern - visibility depends on light angle, not time
    vec2 sparkleUV = v_uv * 40.0;
    float sparkleNoise = texture(u_foilPattern, sparkleUV).r;

    // Sparkles appear based on how the light hits each micro-facet
    float sparkleAngle = spec * 0.5 + 0.5;
    float sparkleThreshold = SPARKLE_THRESHOLD - effectIntensity * 0.1;
    float sparkle = 0.0;
    if (sparkleNoise > sparkleThreshold) {
        // Sparkle intensity based on angle alignment
        sparkle = (sparkleNoise - sparkleThreshold) * SPARKLE_INTENSITY;
        sparkle *= sparkleAngle;
    }

    // Main vertical streak (follows tilt)
    float bandPos = u_cardRotation.y * 0.6 + 0.5;
    float band = max(0.0, 1.0 - abs(v_uv.x - bandPos) * 3.0);
    band = band * band * band * spec * 0.65;

    // Bottom-left vertical streak (simple linear falloff)
    float bottomBandX = u_cardRotation.y * 0.5 + 0.25;
    float bottomStreak = max(0.0, 1.0 - abs(v_uv.x - bottomBandX) * 6.0);
    bottomStreak *= max(0.0, v_uv.y - 0.5) * 2.0;  // Fade in at bottom half
    bottomStreak = bottomStreak * bottomStreak * effectIntensity * 0.6;

    // Circular brushed metal effect (anisotropic highlight)
    vec2 fromCenter = v_uv - 0.5;
    float dist = length(fromCenter);
    float angle = atan(fromCenter.y, fromCenter.x);
    float circularAngle = angle + u_cardRotation.y * 3.0 - u_cardRotation.x * 2.0;
    float circular = sin(circularAngle * 8.0) * 0.5 + 0.5;
    // Brighter core that fades toward edges
    float coreBrightness = 1.0 - dist * 1.2;
    coreBrightness = max(0.2, coreBrightness);
    // Base visibility + spec boost (visible even when spec is low)
    circular = circular * circular * (0.35 + spec * 0.6) * effectIntensity * coreBrightness;

    // Fresnel for edge glint
    float fresnel = 1.0 - max(dot(v_worldNormal, v_viewDirection), 0.0);
    fresnel = pow(fresnel, 3.0);

    // Metallic tint
    vec3 metalColor = vec3(1.0, 0.95, 0.88);
    vec3 highlightColor = vec3(1.0, 1.0, 1.0);

    // Combine effects
    vec3 foilEffect = metalColor * spec * 0.85;  // Main specular
    foilEffect += highlightColor * (sparkle + band + bottomStreak);
    foilEffect += metalColor * circular;  // Brushed metal circles
    foilEffect += metalColor * fresnel * 0.15 * effectIntensity;

    // Final color
    vec3 finalColor = baseColor + foilEffect;

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

    // Alpha = mask for selective bloom (only effect regions bloom)
    fragColor = vec4(finalColor, 1.0);
}
