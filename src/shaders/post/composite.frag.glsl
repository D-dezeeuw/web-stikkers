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

    // Additive bloom, preserve original alpha for transparency
    vec3 finalColor = scene.rgb + bloomColor * u_bloomIntensity;

    fragColor = vec4(finalColor, scene.a);
}
