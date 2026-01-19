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

    // Alpha was used for bloom masking only, restore to 1.0 for final output
    fragColor = vec4(finalColor, 1.0);
}
