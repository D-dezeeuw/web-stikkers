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
const int STAR_LAYERS = 4;
const float STAR_BRIGHTNESS = 1.2;
const float FRESNEL_POWER = 2.5;

// Nebula parameters
const float NEBULA_INTENSITY = 0.5;
const float RAINBOW_BLEND = 0.35;
const float ANGLE_THRESHOLD = 0.12;

// Hash functions
float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float hash2(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Procedural value noise (no texture sampling)
float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Smooth interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    // Four corners
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    // Bilinear interpolation
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Fractal Brownian Motion using procedural noise
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
        value += valueNoise(p) * amplitude;
        p *= 2.1;
        amplitude *= 0.5;
    }
    return value;
}

// Nebula shape using FBM (completely static - no tilt in position)
float nebulaNoise(vec2 uv, vec2 offset) {
    vec2 pos = uv * 3.0 + offset;
    float n = fbm(pos);
    return smoothstep(0.3, 0.7, n);
}

// Star layer generation
float starLayer(vec2 uv, float density, float seed, float starSize) {
    float stars = 0.0;
    vec2 gridUV = uv * density;
    vec2 cellId = floor(gridUV);
    vec2 cellUV = fract(gridUV);

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 cell = cellId + neighbor;
            float h = hash(cell + seed);
            float h2 = hash2(cell + seed * 2.0);

            if (h > 0.6) {
                vec2 starPos = neighbor + vec2(hash(cell + seed + 1.0), hash(cell + seed + 2.0)) * 0.8 + 0.1;
                float dist = length(cellUV - starPos);
                float size = starSize * (0.5 + h2 * 0.5);
                float brightness = smoothstep(size, size * 0.1, dist);
                brightness *= 0.7 + 0.3 * h2;
                stars += brightness;
            }
        }
    }
    return stars;
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

    // === NEBULA CLOUDS (STATIC POSITION - procedural, no texture) ===
    // Three nebula patches at fixed positions

    // Patch 1: upper left area
    float nebula1 = nebulaNoise(v_uv, vec2(0.15, 0.1));
    // Visible when tilting right (positive tilt.x)
    float vis1 = smoothstep(ANGLE_THRESHOLD, ANGLE_THRESHOLD + 0.15, tilt.x);
    vis1 *= smoothstep(0.5, 0.3, tilt.x);

    // Patch 2: lower right area
    float nebula2 = nebulaNoise(v_uv, vec2(-0.25, -0.15));
    // Visible when tilting left (negative tilt.x)
    float vis2 = smoothstep(-ANGLE_THRESHOLD, -ANGLE_THRESHOLD - 0.15, tilt.x);
    vis2 *= smoothstep(-0.5, -0.3, tilt.x);

    // Patch 3: center-bottom area
    float nebula3 = nebulaNoise(v_uv, vec2(0.0, -0.2));
    // Visible when tilting up/down (tilt.y)
    float vis3 = smoothstep(ANGLE_THRESHOLD, ANGLE_THRESHOLD + 0.15, abs(tilt.y));
    vis3 *= smoothstep(0.5, 0.3, abs(tilt.y));

    // === NEBULA COLORS ===
    vec3 nebulaColor1 = vec3(0.25, 0.08, 0.45);  // Purple
    vec3 nebulaColor2 = vec3(0.1, 0.18, 0.5);    // Blue
    vec3 nebulaColor3 = vec3(0.45, 0.12, 0.5);   // Magenta

    // Rainbow iridescence - phase based on UV position + tilt
    float rainbowPhase1 = fract(v_uv.x * 0.8 + v_uv.y * 0.5 + tilt.x * 0.5 + tilt.y * 0.3);
    float rainbowPhase2 = fract(v_uv.x * 0.6 - v_uv.y * 0.7 + tilt.x * 0.4 - tilt.y * 0.4);
    float rainbowPhase3 = fract(v_uv.y * 0.9 + tilt.y * 0.6);

    vec3 rainbow1 = texture(u_rainbowGradient, vec2(rainbowPhase1, 0.5)).rgb;
    vec3 rainbow2 = texture(u_rainbowGradient, vec2(rainbowPhase2, 0.5)).rgb;
    vec3 rainbow3 = texture(u_rainbowGradient, vec2(rainbowPhase3, 0.5)).rgb;

    // Blend base color with rainbow
    vec3 finalNebula1 = mix(nebulaColor1, rainbow1, RAINBOW_BLEND * vis1);
    vec3 finalNebula2 = mix(nebulaColor2, rainbow2, RAINBOW_BLEND * vis2);
    vec3 finalNebula3 = mix(nebulaColor3, rainbow3, RAINBOW_BLEND * vis3);

    // Combine all nebula patches
    vec3 totalNebula = vec3(0.0);
    totalNebula += finalNebula1 * nebula1 * vis1;
    totalNebula += finalNebula2 * nebula2 * vis2;
    totalNebula += finalNebula3 * nebula3 * vis3;

    // === STAR FIELD (multiple layers with parallax) ===
    vec3 starColor = vec3(0.0);

    float densities[4];
    densities[0] = 8.0;
    densities[1] = 15.0;
    densities[2] = 25.0;
    densities[3] = 40.0;

    float sizes[4];
    sizes[0] = 0.12;
    sizes[1] = 0.08;
    sizes[2] = 0.05;
    sizes[3] = 0.03;

    float parallax[4];
    parallax[0] = 0.15;
    parallax[1] = 0.08;
    parallax[2] = 0.03;
    parallax[3] = 0.0;

    vec3 starTints[4];
    starTints[0] = vec3(1.0, 0.9, 0.7);   // Warm (close)
    starTints[1] = vec3(1.0, 1.0, 1.0);   // White
    starTints[2] = vec3(0.8, 0.9, 1.0);   // Cool
    starTints[3] = vec3(0.6, 0.7, 1.0);   // Blue (far)

    for (int i = 0; i < STAR_LAYERS; i++) {
        vec2 offsetUV = v_uv + vec2(tilt.y, tilt.x) * parallax[i];
        float stars = starLayer(offsetUV, densities[i], float(i) * 100.0, sizes[i]);
        starColor += stars * STAR_BRIGHTNESS * starTints[i];
    }

    // === SHOOTING STAR (moves diagonally with up/down tilt) ===
    vec2 shootDir = normalize(vec2(0.7, -0.7));  // Diagonal: top-left to bottom-right
    // Start offset toward top-right, moves along diagonal based on tilt.y
    vec2 shootCenter = vec2(0.65, 0.35) + vec2(tilt.y, -tilt.y) * 0.4;
    float shootPos = dot(v_uv - shootCenter, shootDir);
    float shootWidth = abs(dot(v_uv - shootCenter, vec2(-shootDir.y, shootDir.x)));
    // Half length, 25% thinner
    float shootStar = smoothstep(-0.075, 0.0, shootPos) * smoothstep(0.175, 0.075, shootPos);
    shootStar *= smoothstep(0.011, 0.0, shootWidth);
    shootStar *= smoothstep(0.05, 0.15, abs(tilt.y));  // Only visible when tilting up/down

    // Fresnel rim
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);
    vec3 rimColor = vec3(0.4, 0.3, 0.8);
    vec3 rim = rimColor * fresnel * 0.5 * effectIntensity;

    // === COMBINE ===
    vec3 spaceBase = baseColor * 0.7;

    vec3 finalColor = spaceBase;
    finalColor += totalNebula * NEBULA_INTENSITY;
    finalColor += starColor;
    finalColor += vec3(shootStar) * vec3(1.0, 0.95, 0.8);
    finalColor += rim;

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
    fragColor = vec4(finalColor, mask);
}
