// Parallax utility functions
// Creates depth illusion by offsetting UV based on depth map and viewing angle

// Get parallax-adjusted UV coordinates
// uv: original texture coordinates
// depthMap: grayscale texture (1.0 = front/no shift, 0.0 = back/max shift)
// tilt: card rotation angles (x, y) in radians
// strength: parallax intensity (recommended: 0.02 - 0.06)
vec2 parallaxUV(vec2 uv, sampler2D depthMap, vec2 tilt, float strength) {
    float depth = 1.0 - texture(depthMap, uv).r;
    vec2 offset = vec2(tilt.y, -tilt.x) * depth * strength;
    return uv + offset;
}

// Sample texture with parallax offset applied
vec4 sampleParallax(sampler2D tex, sampler2D depthMap, vec2 uv, vec2 tilt, float strength) {
    vec2 offsetUV = parallaxUV(uv, depthMap, tilt, strength);
    return texture(tex, clamp(offsetUV, 0.0, 1.0));
}

// Multi-layer parallax for enhanced depth effect
// Returns color sampled from multiple depth layers
vec3 sampleParallaxLayers(sampler2D tex, sampler2D depthMap, vec2 uv, vec2 tilt, float strength) {
    // Sample at three depth levels
    float depth = 1.0 - texture(depthMap, uv).r;

    vec2 offset1 = vec2(tilt.y, -tilt.x) * depth * strength * 0.5;
    vec2 offset2 = vec2(tilt.y, -tilt.x) * depth * strength;

    vec3 layer0 = texture(tex, uv).rgb;
    vec3 layer1 = texture(tex, clamp(uv + offset1, 0.0, 1.0)).rgb;
    vec3 layer2 = texture(tex, clamp(uv + offset2, 0.0, 1.0)).rgb;

    // Blend layers with depth-based weights
    float tiltMag = length(tilt);
    vec3 result = layer2 * 0.2;
    result = mix(result, layer1, 0.4 + tiltMag);
    result = mix(result, layer0, 0.7);

    return result;
}
