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
uniform sampler2D u_collectionTexture;
uniform float u_time;
uniform vec2 u_mousePosition;
uniform vec2 u_cardRotation;

out vec4 fragColor;

void main() {
    vec4 baseColor = texture(u_baseTexture, v_uv);
    vec3 finalColor = baseColor.rgb;

    // Overlay text on base texture (white text)
    float textAlpha = texture(u_textTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), textAlpha);

    // Overlay number (white text, no shader effects)
    float numberAlpha = texture(u_numberTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), numberAlpha);

    // Overlay collection name (white text, no shader effects)
    float collectionAlpha = texture(u_collectionTexture, v_uv).r;
    finalColor = mix(finalColor, vec3(1.0), collectionAlpha);

    // Alpha = 1 for card pixels (no bloom for base shader, handled by bloom threshold)
    fragColor = vec4(finalColor, 1.0);
}
