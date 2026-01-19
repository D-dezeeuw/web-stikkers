#version 300 es
precision highp float;

layout(location = 0) in vec3 a_position;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec3 a_normal;
layout(location = 3) in vec3 a_tangent;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform vec3 u_cameraPosition;

out vec2 v_uv;
out vec3 v_worldPosition;
out vec3 v_worldNormal;
out vec3 v_viewDirection;
out vec3 v_tangentViewDir;
out float v_depth;

void main() {
    // World position
    vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
    v_worldPosition = worldPos.xyz;

    // View and clip position
    vec4 viewPos = u_viewMatrix * worldPos;
    gl_Position = u_projectionMatrix * viewPos;

    // Depth (normalized for effects, near=0.1, far=10.0)
    v_depth = clamp((-viewPos.z - 0.1) / (10.0 - 0.1), 0.0, 1.0);

    // World normal (rotation only, no scale applied to normals)
    mat3 normalMatrix = mat3(u_modelMatrix);
    v_worldNormal = normalize(normalMatrix * a_normal);

    // View direction (from surface to camera)
    v_viewDirection = normalize(u_cameraPosition - v_worldPosition);

    // Tangent space view direction (for parallax/normal mapping)
    vec3 T = normalize(normalMatrix * a_tangent);
    vec3 N = v_worldNormal;
    vec3 B = cross(N, T);
    mat3 TBN = transpose(mat3(T, B, N));
    v_tangentViewDir = TBN * v_viewDirection;

    // UV passthrough
    v_uv = a_uv;
}
