#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform float u_threshold;

out vec4 fragColor;

void main() {
    vec4 color = texture(u_texture, v_uv);

    // Only extract HDR overflow (values > 1.0) - this is where effects add brightness
    // Regular texture stays in 0-1 range and won't bloom
    float maxChannel = max(max(color.r, color.g), color.b);
    float hdrOverflow = max(0.0, maxChannel - 1.0);

    if (hdrOverflow > 0.0) {
        // Extract the HDR portion that exceeds 1.0
        float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
        float contribution = hdrOverflow / (hdrOverflow + 0.3);
        fragColor = vec4(color.rgb * contribution, 1.0);
    } else {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
