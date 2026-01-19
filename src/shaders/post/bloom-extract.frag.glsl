#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform float u_threshold;

out vec4 fragColor;

void main() {
    vec4 color = texture(u_texture, v_uv);

    // Alpha channel is used as bloom mask (0 = no bloom, 1 = full bloom)
    float bloomMask = color.a;

    // Skip pixels with no bloom contribution
    if (bloomMask < 0.01) {
        fragColor = vec4(0.0);
        return;
    }

    // Calculate luminance
    float brightness = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));

    // Extract bright areas above threshold, masked by alpha
    if (brightness > u_threshold) {
        // Soft knee - gradual transition
        float soft = brightness - u_threshold;
        float contribution = soft / (soft + 0.5);
        fragColor = vec4(color.rgb * contribution * bloomMask, 1.0);
    } else {
        fragColor = vec4(0.0);
    }
}
