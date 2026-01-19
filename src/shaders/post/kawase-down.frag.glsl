#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform vec2 u_halfPixel;  // 0.5 / resolution

out vec4 fragColor;

void main() {
    // Dual Kawase downsample: 5 samples leveraging hardware bilinear filtering
    // Samples the center + 4 corners offset by half-pixel
    // Hardware filtering effectively gives us 4x the samples for free

    vec4 sum = texture(u_texture, v_uv) * 4.0;
    sum += texture(u_texture, v_uv - u_halfPixel);
    sum += texture(u_texture, v_uv + u_halfPixel);
    sum += texture(u_texture, v_uv + vec2(u_halfPixel.x, -u_halfPixel.y));
    sum += texture(u_texture, v_uv + vec2(-u_halfPixel.x, u_halfPixel.y));

    fragColor = sum / 8.0;
}
