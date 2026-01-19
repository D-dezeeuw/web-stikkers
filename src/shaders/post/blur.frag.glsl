#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform vec2 u_direction;  // (1/width, 0) for horizontal, (0, 1/height) for vertical
uniform float u_radius;

out vec4 fragColor;

void main() {
    vec4 color = vec4(0.0);
    float total = 0.0;

    // 9-tap gaussian blur
    float weights[5];
    weights[0] = 0.227027;
    weights[1] = 0.1945946;
    weights[2] = 0.1216216;
    weights[3] = 0.054054;
    weights[4] = 0.016216;

    // Center sample
    color += texture(u_texture, v_uv) * weights[0];
    total += weights[0];

    // Offset samples
    for (int i = 1; i < 5; i++) {
        vec2 offset = u_direction * float(i) * u_radius;
        color += texture(u_texture, v_uv + offset) * weights[i];
        color += texture(u_texture, v_uv - offset) * weights[i];
        total += weights[i] * 2.0;
    }

    fragColor = color / total;
}
