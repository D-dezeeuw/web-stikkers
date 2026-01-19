#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_scene;

out vec4 fragColor;

void main() {
    // Simple passthrough - HDR/saturation removed
    fragColor = texture(u_scene, v_uv);
}
