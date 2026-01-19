#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_scene;
uniform float u_hdrEnabled;
uniform float u_saturationBoost;

out vec4 fragColor;

void main() {
    vec4 scene = texture(u_scene, v_uv);
    vec3 color = scene.rgb;

    // HDR + ACES Filmic Tonemapping
    if (u_hdrEnabled > 0.5) {
        vec3 hdr = color * (1.0 + color * 0.5);
        vec3 a = hdr * (hdr + 0.0245786) - 0.000090537;
        vec3 b = hdr * (0.983729 * hdr + 0.4329510) + 0.238081;
        color = a / b;
        float brightness = dot(color, vec3(0.299, 0.587, 0.114));
        float glow = smoothstep(0.5, 1.0, brightness) * 0.15;
        color += color * glow;
    }

    // Saturation boost
    if (u_saturationBoost > 0.5) {
        vec3 gray = vec3(dot(color, vec3(0.299, 0.587, 0.114)));
        color = mix(gray, color, 1.5);
    }

    // Preserve scene alpha for transparency
    fragColor = vec4(color, scene.a);
}
