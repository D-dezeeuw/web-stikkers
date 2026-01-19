#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform float u_threshold;

out vec4 fragColor;

void main() {
    vec4 color = texture(u_texture, v_uv);

    // Calculate luminance
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Extract bright areas above threshold
    if (brightness > u_threshold) {
        // Soft knee - gradual transition
        float soft = brightness - u_threshold;
        float contribution = soft / (soft + 0.5);
        fragColor = vec4(color.rgb * contribution, 1.0);
    } else {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
