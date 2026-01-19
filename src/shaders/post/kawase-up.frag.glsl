#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform vec2 u_halfPixel;  // 0.5 / resolution

out vec4 fragColor;

void main() {
    // Dual Kawase upsample: 8 samples in tent filter pattern
    // Weighted sampling creates smooth interpolation during upscale

    vec4 sum = vec4(0.0);

    // Corner samples (weight 1)
    sum += texture(u_texture, v_uv + vec2(-u_halfPixel.x * 2.0, 0.0));
    sum += texture(u_texture, v_uv + vec2(0.0, u_halfPixel.y * 2.0));
    sum += texture(u_texture, v_uv + vec2(u_halfPixel.x * 2.0, 0.0));
    sum += texture(u_texture, v_uv + vec2(0.0, -u_halfPixel.y * 2.0));

    // Diagonal samples (weight 2)
    sum += texture(u_texture, v_uv + vec2(-u_halfPixel.x, u_halfPixel.y)) * 2.0;
    sum += texture(u_texture, v_uv + vec2(u_halfPixel.x, u_halfPixel.y)) * 2.0;
    sum += texture(u_texture, v_uv + vec2(u_halfPixel.x, -u_halfPixel.y)) * 2.0;
    sum += texture(u_texture, v_uv + vec2(-u_halfPixel.x, -u_halfPixel.y)) * 2.0;

    fragColor = sum / 12.0;
}
