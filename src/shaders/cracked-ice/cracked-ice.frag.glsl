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
uniform float u_showMask;
uniform float u_textOpacity;

out vec4 fragColor;

// Parameters
const float CELL_SCALE = 12.0;
const float CRACK_WIDTH = 0.04;
const float CRACK_GLOW = 1.0;
const float CELL_TINT_STRENGTH = 0.4;
const float FRESNEL_POWER = 2.5;

// Hash functions
float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

vec2 hash2D(vec2 p) {
    return vec2(
        hash(p),
        hash(p + vec2(127.1, 311.7))
    );
}

// Voronoi distance field - returns distance to nearest cell edge
float voronoi(vec2 uv, float scale, out vec2 cellCenter, out float cellId) {
    vec2 scaledUV = uv * scale;
    vec2 cell = floor(scaledUV);
    vec2 frac = fract(scaledUV);

    float minDist = 1.0;
    vec2 nearestPoint = vec2(0.0);
    vec2 nearestCell = vec2(0.0);

    // Check 3x3 neighborhood
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 currentCell = cell + neighbor;

            // Random point within this cell
            vec2 point = hash2D(currentCell) * 0.8 + 0.1;
            vec2 diff = neighbor + point - frac;
            float dist = length(diff);

            if (dist < minDist) {
                minDist = dist;
                nearestPoint = point;
                nearestCell = currentCell;
            }
        }
    }

    cellCenter = nearestPoint;
    cellId = hash(nearestCell);
    return minDist;
}

// Second pass to find edge distance
float voronoiEdge(vec2 uv, float scale) {
    vec2 scaledUV = uv * scale;
    vec2 cell = floor(scaledUV);
    vec2 frac = fract(scaledUV);

    float minDist1 = 1.0;
    float minDist2 = 1.0;

    // Find two nearest points
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 currentCell = cell + neighbor;
            vec2 point = hash2D(currentCell) * 0.8 + 0.1;
            vec2 diff = neighbor + point - frac;
            float dist = length(diff);

            if (dist < minDist1) {
                minDist2 = minDist1;
                minDist1 = dist;
            } else if (dist < minDist2) {
                minDist2 = dist;
            }
        }
    }

    // Edge is where two cells meet
    return minDist2 - minDist1;
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

    // Calculate voronoi
    vec2 cellCenter;
    float cellId;
    float dist = voronoi(v_uv, CELL_SCALE, cellCenter, cellId);
    float edgeDist = voronoiEdge(v_uv, CELL_SCALE);

    // Crack lines (edges between cells)
    float crack = 1.0 - smoothstep(0.0, CRACK_WIDTH, edgeDist);

    // Each cell gets a unique color tint based on tilt
    float cellPhase = fract(cellId + tilt.x * 0.5 + tilt.y * 0.5);
    vec3 cellTint = texture(u_rainbowGradient, vec2(cellPhase, 0.5)).rgb;

    // Cell brightness variation
    float cellBrightness = 0.85 + cellId * 0.3;

    // Apply cell tint based on effect intensity
    vec3 cellColor = mix(baseColor, baseColor * cellTint, CELL_TINT_STRENGTH * effectIntensity);
    cellColor *= cellBrightness;

    // Light direction based on tilt
    vec3 lightDir = normalize(vec3(tilt.y * 2.0, -tilt.x * 2.0 + 0.5, 1.0));

    // Specular highlight per cell (each cell reflects differently)
    vec3 cellNormal = normalize(vec3(
        (cellId - 0.5) * 0.3,
        (hash(vec2(cellId * 10.0, 0.0)) - 0.5) * 0.3,
        1.0
    ));
    vec3 reflectDir = reflect(-lightDir, cellNormal);
    float spec = pow(max(dot(reflectDir, v_viewDirection), 0.0), 32.0);
    spec *= effectIntensity;

    // Crack glow color (bright cyan/white)
    vec3 crackColor = vec3(0.7, 0.9, 1.0);

    // Crack glow intensity increases with effect
    float crackGlow = crack * CRACK_GLOW * (0.3 + effectIntensity * 0.7);

    // Fresnel for edge effect
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);
    vec3 rimColor = vec3(0.5, 0.7, 1.0);
    vec3 rim = rimColor * fresnel * 0.4 * effectIntensity;

    // Combine effects
    vec3 finalColor = cellColor;
    finalColor += vec3(spec * 0.4);
    finalColor += crackColor * crackGlow;
    finalColor += rim;

    // Slight darkening at crack edges for depth
    finalColor *= 1.0 - crack * 0.2;

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
