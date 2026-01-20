# Shader Generator Guide

This document provides everything needed to generate new WebGL fragment shaders for the sticker card system.

## Quick Start

When asked to create a new shader effect, follow these steps:
1. Create the fragment shader file at `src/shaders/{name}/{name}.frag.glsl`
2. Register it in `src/shaders/ShaderManager.js`
3. Add texture requirements to `src/card/CardRenderer.js` SHADER_TEXTURES map
4. Add to UI dropdowns in `index.html` and `sticker-demo.html`

## Shader Architecture

### File Structure
```
src/shaders/
├── base/
│   ├── base.vert.glsl    # Shared vertex shader (DO NOT MODIFY)
│   └── base.frag.glsl    # Simplest fragment shader (reference)
├── holographic/
│   └── holographic.frag.glsl
├── foil/
│   └── foil.frag.glsl
└── {new-shader}/
    └── {new-shader}.frag.glsl
```

### Required Shader Header
Every fragment shader MUST start with:
```glsl
#version 300 es
precision highp float;
```

## Available Inputs

### Varyings (from vertex shader)
```glsl
in vec2 v_uv;              // Texture coordinates (0-1)
in vec3 v_worldPosition;   // World space position
in vec3 v_worldNormal;     // World space normal (for lighting)
in vec3 v_viewDirection;   // Direction from surface to camera
in vec3 v_tangentViewDir;  // View direction in tangent space
in vec3 v_tangent;         // Tangent vector (for anisotropic effects)
in vec3 v_bitangent;       // Bitangent vector
in float v_depth;          // Normalized depth (0-1, for distance effects)
```

### Uniforms - Always Available
```glsl
// Textures
uniform sampler2D u_baseTexture;      // Card image (slot 0)
uniform sampler2D u_effectMask;       // Where effects apply (slot 5)
uniform sampler2D u_textTexture;      // Card name text (slot 6)
uniform sampler2D u_numberTexture;    // Card number (slot 7)
uniform sampler2D u_collectionTexture; // Collection name (slot 8)

// Animation & Interaction
uniform float u_time;                 // Elapsed time in seconds
uniform vec2 u_mousePosition;         // Mouse position (normalized)
uniform vec2 u_cardRotation;          // Card tilt in radians (x=pitch, y=yaw)

// Effect Control
uniform float u_maskActive;           // 1.0 if mask enabled, 0.0 if full
uniform float u_isBaseShader;         // 1.0 for base shader only
uniform float u_textOpacity;          // Text overlay opacity (default 0.2)
uniform float u_effectScale;          // Effect intensity multiplier

// Variant (Parallel) Support
uniform vec3 u_variantColor;          // Variant tint color (RGB)
uniform float u_variantActive;        // 1.0 if variant active
```

### Uniforms - Optional (declare only if needed)
```glsl
uniform sampler2D u_rainbowGradient;  // HSL spectrum (slot 1) - for iridescence
uniform sampler2D u_noiseTexture;     // Organic noise (slot 2) - for variation
uniform sampler2D u_foilPattern;      // Sparkle pattern (slot 3) - for foil
uniform sampler2D u_depthMap;         // Depth/height map (slot 4) - for parallax
```

### Output
```glsl
out vec4 fragColor;  // Final RGBA color
```

## Standard Shader Template

```glsl
#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_viewDirection;
in vec3 v_tangentViewDir;
in float v_depth;

uniform sampler2D u_baseTexture;
uniform sampler2D u_rainbowGradient;  // Include if using rainbow/iridescence
uniform sampler2D u_noiseTexture;     // Include if using noise
uniform sampler2D u_effectMask;
uniform sampler2D u_textTexture;
uniform sampler2D u_numberTexture;
uniform sampler2D u_collectionTexture;
uniform float u_time;
uniform vec2 u_mousePosition;
uniform vec2 u_cardRotation;
uniform float u_textOpacity;
uniform float u_effectScale;          // Include if shader is intense
uniform vec3 u_variantColor;
uniform float u_variantActive;

out vec4 fragColor;

// Constants
const float MIN_EFFECT = 0.3;  // Minimum visibility when not tilting
const float FRESNEL_POWER = 2.5;

// Utility: Fresnel rim lighting
float calculateFresnel(vec3 normal, vec3 viewDir) {
    float fresnel = 1.0 - max(dot(normal, viewDir), 0.0);
    return pow(fresnel, FRESNEL_POWER);
}

void main() {
    // 1. Sample base texture
    vec4 baseTexture = texture(u_baseTexture, v_uv);
    vec3 baseColor = baseTexture.rgb;
    vec3 originalColor = baseColor;  // Store for mask blending

    // 2. Calculate effect intensity from tilt
    float tiltMagnitude = length(u_cardRotation);
    float effectIntensity = MIN_EFFECT + tiltMagnitude * (1.0 - MIN_EFFECT);
    vec2 tilt = u_cardRotation;

    // 3. === YOUR EFFECT CODE HERE ===
    // Use tilt.x (left/right) and tilt.y (up/down) to drive effects
    // Use effectIntensity to scale the overall effect

    vec3 effectColor = baseColor;  // Replace with your effect

    // Example: Add fresnel rim
    float fresnel = calculateFresnel(v_worldNormal, v_viewDirection);
    vec3 rimColor = vec3(0.5, 0.7, 1.0);
    vec3 rim = rimColor * fresnel * 0.4 * effectIntensity;

    // 4. Combine base + effect
    vec3 finalColor = effectColor + rim;

    // If using u_effectScale (for intense shaders):
    // vec3 finalColor = baseColor + (effectColor - baseColor + rim) * u_effectScale;

    // 5. Apply effect mask (REQUIRED)
    float mask = texture(u_effectMask, v_uv).r;
    float textMask = texture(u_textTexture, v_uv).r;
    mask = max(mask, textMask);  // Text areas get the effect
    finalColor = mix(originalColor, finalColor, mask);

    // 6. Apply variant color (REQUIRED for parallel support)
    vec3 tintedColor = mix(finalColor, finalColor * u_variantColor, 0.4);
    vec3 overlayColor = mix(tintedColor, u_variantColor, 0.1);
    finalColor = mix(finalColor, overlayColor, u_variantActive * mask);

    // 7. Apply text overlays (REQUIRED)
    finalColor = mix(finalColor, vec3(1.0), textMask * u_textOpacity);

    float numberAlpha = texture(u_numberTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), numberAlpha);

    float collectionAlpha = texture(u_collectionTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), collectionAlpha);

    // 8. Output
    fragColor = vec4(finalColor, 1.0);
}
```

## Common Effect Techniques

### Rainbow/Iridescence
```glsl
// Phase based on position + tilt for shifting colors
float rainbowPhase = fract(v_uv.x * 0.5 + v_uv.y * 0.3 + tilt.x * 0.5 + tilt.y * 0.3);
vec3 rainbow = texture(u_rainbowGradient, vec2(rainbowPhase, 0.5)).rgb;
```

### Sparkles/Glitter
```glsl
// High-frequency noise threshold for sparkle points
float sparkleNoise = texture(u_noiseTexture, v_uv * 40.0).r;
float sparkleThreshold = 0.85;
float sparkle = smoothstep(sparkleThreshold, 1.0, sparkleNoise) * effectIntensity;
```

### Light Band (follows tilt)
```glsl
// Vertical band that moves with horizontal tilt
float bandPos = tilt.y * 0.6 + 0.5;  // Center + tilt offset
float band = max(0.0, 1.0 - abs(v_uv.x - bandPos) * 3.0);
band *= effectIntensity;
```

### Specular Highlight
```glsl
vec3 lightDir = normalize(vec3(tilt.y * 2.0 + 0.3, -tilt.x * 2.0 + 0.5, 1.0));
vec3 reflectDir = reflect(-lightDir, v_worldNormal);
float spec = pow(max(dot(reflectDir, v_viewDirection), 0.0), 32.0);
spec *= effectIntensity;
```

### Parallax Offset
```glsl
// Sample texture at offset position based on view angle
float depth = texture(u_depthMap, v_uv).r;
vec2 parallaxOffset = v_tangentViewDir.xy * depth * 0.05;
vec3 parallaxColor = texture(u_baseTexture, v_uv + parallaxOffset).rgb;
```

### Procedural Noise (no texture)
```glsl
float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
```

### Anisotropic Highlight (brushed metal)
```glsl
// Ward BRDF for stretched highlights
float wardAnisotropic(vec3 N, vec3 H, vec3 T, vec3 B, float ax, float ay) {
    float NdotH = max(dot(N, H), 0.001);
    float TdotH = dot(T, H);
    float BdotH = dot(B, H);

    float exponent = -2.0 * (
        (TdotH * TdotH) / (ax * ax) +
        (BdotH * BdotH) / (ay * ay)
    ) / (1.0 + NdotH);

    float denom = 4.0 * 3.14159 * ax * ay * sqrt(NdotH);
    return exp(exponent) / max(denom, 0.001);
}
```

## Registration Checklist

### 1. Add to ShaderManager.js
```javascript
// In loadShaders() or where shaders are loaded:
await this.shaderManager.loadShader(
    'new-effect',
    baseVertPath,
    'src/shaders/new-effect/new-effect.frag.glsl'
)
```

### 2. Add to CardRenderer.js SHADER_TEXTURES
```javascript
const SHADER_TEXTURES = {
    // ... existing shaders ...
    'new-effect': ['base', 'rainbow', 'noise', 'effectMask', 'text', 'number', 'collection'],
}
```
Only include textures your shader actually uses!

### 3. Add to ShaderRegistry.js
```javascript
export const SHADER_NAMES = [
    // ... existing names ...
    'new-effect'
]
```

### 4. Add to UI (index.html)
```html
<select id="shader-select">
    <!-- ... existing options ... -->
    <option value="new-effect">New Effect</option>
</select>
```

### 5. Add to sticker-demo.html
```html
<select id="shader-select">
    <!-- ... existing options ... -->
    <option value="new-effect">New Effect</option>
</select>
```

## Effect Intensity Guidelines

| Effect Type | Recommended Intensity |
|-------------|----------------------|
| Subtle shimmer | 0.2 - 0.4 |
| Standard foil | 0.5 - 0.8 |
| Bright holographic | 0.8 - 1.2 |
| HDR bloom-heavy | 1.0 - 1.5 |

Effects over 1.0 will bloom (glow beyond the card edges).

## Testing Your Shader

1. Start dev server: `npm run dev`
2. Open http://localhost:8080
3. Select your shader from dropdown
4. Test with different masks (especially "border" and "normal")
5. Test with variants (Blue, Gold, etc.)
6. Verify text remains readable
7. Check performance with DevTools (target 60fps)

## Existing Shader Reference

| Shader | Key Technique | Textures Used |
|--------|---------------|---------------|
| holographic | Multi-scale rainbow + sparkles | rainbow, noise |
| foil | Anisotropic specular + sparkles | noise, foil |
| parallax | Multi-layer depth offset | depth |
| galaxy | Procedural stars + nebula | rainbow |
| starburst | Radial rays from center | rainbow, noise |
| prizm | Triangle facets + per-facet color | rainbow, noise |
| etched | Matte/metallic contrast + emboss | noise, depth |
| cracked-ice | Voronoi cells + refraction | rainbow, noise |
| refractor | Chromatic aberration | rainbow, noise |

## Common Pitfalls

1. **Forgetting mask application** - Effect shows everywhere instead of masked areas
2. **Missing variant support** - Parallels don't show colored borders
3. **Not using effectIntensity** - Effect looks the same regardless of tilt
4. **Text unreadable** - Forgot to apply text overlay at the end
5. **Performance issues** - Too many texture samples or complex math in inner loops
6. **Harsh transitions** - Use smoothstep() instead of step() for soft edges
