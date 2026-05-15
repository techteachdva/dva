shader_type canvas_item;

uniform vec4 base_color : source_color = vec4(1.0, 0.42, 0.08, 1.0);
uniform float speed : hint_range(0.0, 1.0) = 0.15;
uniform bool rainbow_mode = false;

float hash3(vec3 p) {
    p  = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float c000 = hash3(i + vec3(0,0,0));
    float c100 = hash3(i + vec3(1,0,0));
    float c010 = hash3(i + vec3(0,1,0));
    float c110 = hash3(i + vec3(1,1,0));
    float c001 = hash3(i + vec3(0,0,1));
    float c101 = hash3(i + vec3(1,0,1));
    float c011 = hash3(i + vec3(0,1,1));
    float c111 = hash3(i + vec3(1,1,1));
    float cx00 = mix(c000, c100, f.x);
    float cx10 = mix(c010, c110, f.x);
    float cx01 = mix(c001, c101, f.x);
    float cx11 = mix(c011, c111, f.x);
    float cxy0 = mix(cx00, cx10, f.y);
    float cxy1 = mix(cx01, cx11, f.y);
    return mix(cxy0, cxy1, f.z);
}

float fbm3(vec3 p) {
    float v = 0.0;
    float a = 0.55;
    vec3 rot = vec3(1.1, 0.7, 0.9);
    for (int i = 0; i < 3; i++) {
        v += a * noise3(p);
        p = p * 2.0 + rot;
        rot = rot.zxy + 0.3;
        a *= 0.45;
    }
    return v;
}

// Convert HSV to RGB
vec3 hsv2rgb(vec3 c) {
    vec4 k = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + k.xyz) * 6.0 - k.www);
    return c.z * mix(k.xxx, clamp(p - k.xxx, 0.0, 1.0), c.y);
}

void fragment() {
    vec2 uv = UV;
    float t = TIME * speed;

    // Scale UVs to get large screen-filling blobs
    vec3 p = vec3(uv * 2.5, 0.0) + vec3(0.0, t * 0.35, 0.0);

    float q1 = fbm3(p + vec3(0.0));
    float q2 = fbm3(p + vec3(5.2, 1.3, 2.8));
    vec3 q = vec3(q1, q2, fbm3(p + vec3(3.1, 7.4, 1.7)));

    float r1 = fbm3(p + q * 1.2 + vec3(1.7, 9.2, 3.1) + t * vec3(0.05, 0.03, 0.04));
    float r2 = fbm3(p + q * 1.2 + vec3(8.3, 2.8, 4.5) + t * vec3(0.04, 0.06, 0.03));
    vec3 r = vec3(r1, r2, 0.0);

    float f = fbm3(p + r * 0.85);

    // Blob masks
    float blobs  = smoothstep(0.40, 0.54, f);
    float glow   = smoothstep(0.28, 0.54, f) * 0.25;
    float core   = smoothstep(0.52, 0.68, f);

    // Hue for rainbow mode: driven by blob noise position so each blob is a different color
    float hue = fract(r1 * 0.7 + r2 * 0.3 + t * 0.08);
    vec3 rainbow_mid  = hsv2rgb(vec3(hue, 0.90, 0.92));
    vec3 rainbow_lit  = hsv2rgb(vec3(fract(hue + 0.08), 0.80, 1.0));
    vec3 rainbow_core = hsv2rgb(vec3(fract(hue + 0.15), 0.70, 1.0));

    vec3 oil_col  = base_color.rgb * 0.05;
    vec3 wax_dark = base_color.rgb * 0.30;
    vec3 wax_mid  = base_color.rgb * 0.75;
    vec3 wax_lit  = min(base_color.rgb * 1.15 + vec3(0.15, 0.10, 0.04), vec3(1.0));
    vec3 wax_core = min(base_color.rgb * 1.6  + vec3(0.28, 0.20, 0.10), vec3(1.0));

    if (rainbow_mode) {
        wax_dark = rainbow_mid * 0.35;
        wax_mid  = rainbow_mid;
        wax_lit  = rainbow_lit;
        wax_core = rainbow_core;
    }

    vec3 color = oil_col;
    color = mix(color, wax_dark, blobs * 0.65);
    color = mix(color, wax_mid, glow);
    color = mix(color, wax_lit, blobs * 0.45);
    color = mix(color, wax_core, core * 0.55);

    // Bottom vignette so text stays readable
    float vig = 1.0 - smoothstep(0.35, 0.85, UV.y);
    color = mix(color, color * 0.35 + base_color.rgb * 0.08, vig * 0.45);

    COLOR = vec4(color, 1.0);
}
