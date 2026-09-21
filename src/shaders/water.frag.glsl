uniform sampler2D uDepthTexture;
uniform bool uHasDepthTexture;
uniform vec2 uScreenResolution;
uniform float uDepthFadeDistance;
uniform float uAbsorbance;
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform float uFoamAmount;
uniform vec3 uFoamColor;
uniform vec3 u_waterColor;
uniform float uRoughness;
uniform float uOpacity;
uniform float uTime;
uniform float uCameraNear;
uniform float uCameraFar;

varying vec3 vWorldPosition;
varying float vViewDepth;
varying vec2 vUv;

float perspectiveDepthToViewDepth(float depth) {
    return (uCameraNear * uCameraFar) /
        ((uCameraFar - uCameraNear) * depth - uCameraFar) * -1.0;
}

vec3 screenBlend(vec3 base, vec3 blend) {
    return 1.0 - (1.0 - base) * (1.0 - blend);
}

float foamNoise(vec2 position) {
    vec2 cell = floor(position);
    vec2 local = fract(position);
    float a = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    float b = fract(sin(dot(cell + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
    float c = fract(sin(dot(cell + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
    float d = fract(sin(dot(cell + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
    vec2 smoothLocal = local * local * (3.0 - 2.0 * local);
    return mix(mix(a, b, smoothLocal.x), mix(c, d, smoothLocal.x), smoothLocal.y);
}

void main() {
    float verticalDepth = 1.0;
    if (uHasDepthTexture) {
        vec2 uv = gl_FragCoord.xy / uScreenResolution;
        float sceneDepth = texture2D(uDepthTexture, uv).r;
        float sceneViewDepth = perspectiveDepthToViewDepth(sceneDepth);
        verticalDepth = max(sceneViewDepth - vViewDepth, 0.0);
    }

    float depthBlend = clamp(exp(-verticalDepth / max(uDepthFadeDistance, 0.001)), 0.0, 1.0);
    float alphaBlend = uHasDepthTexture ? clamp(1.0 - exp(-verticalDepth * uAbsorbance), 0.0, 1.0) : 1.0;
    float foamEdge = clamp(1.0 - verticalDepth / max(uFoamAmount, 0.001), 0.0, 1.0);
    float foamDetail = smoothstep(0.35, 0.75, foamNoise(vWorldPosition.xz * 0.7 + vec2(uTime * 0.08)));
    float foamBlend = foamEdge * mix(0.55, 1.0, foamDetail);

    vec3 colorOut = mix(uDeepColor, uShallowColor, depthBlend);
    colorOut = mix(colorOut, u_waterColor, 0.5);
    colorOut = screenBlend(colorOut, uFoamColor * foamBlend);
    gl_FragColor = vec4(colorOut, alphaBlend * uOpacity);
}
