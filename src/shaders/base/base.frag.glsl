#version 300 es
precision highp float;

in vec2 v_uv;
in vec3 v_worldPosition;
in vec3 v_worldNormal;
in vec3 v_viewDirection;
in vec3 v_tangentViewDir;
in float v_depth;

uniform sampler2D u_baseTexture;
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

void main() {
    vec4 baseColor = texture(u_baseTexture, v_uv);
    vec3 finalColor = baseColor.rgb;

    // Overlay text on base texture (white text)
    float textAlpha = texture(u_textTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), textAlpha);

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
        fragColor = vec4(vec3(maskValue), baseColor.a);
        return;
    }

    // Overlay number (white text, no shader effects)
    float numberAlpha = texture(u_numberTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), numberAlpha);

    // Alpha = 0 means no bloom contribution (base shader has no metallic effects)
    fragColor = vec4(finalColor, 0.0);
}
