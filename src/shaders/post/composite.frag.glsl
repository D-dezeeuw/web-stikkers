#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_bloomIntensity;

out vec4 fragColor;

void main() {
    vec4 scene = texture(u_scene, v_uv);
    vec3 bloomColor = texture(u_bloom, v_uv).rgb;

    // Additive bloom
    vec3 finalColor = scene.rgb + bloomColor * u_bloomIntensity;

    // Bloom contributes to alpha so glow extends beyond card edges
    // Card pixels: scene.a = 1.0 (opaque)
    // Background with bloom: scene.a = 0 but bloom makes it visible
    // Background without bloom: stays transparent
    float bloomBrightness = dot(bloomColor, vec3(0.299, 0.587, 0.114)) * u_bloomIntensity;
    float finalAlpha = max(scene.a, clamp(bloomBrightness, 0.0, 1.0));

    fragColor = vec4(finalColor, finalAlpha);
}
