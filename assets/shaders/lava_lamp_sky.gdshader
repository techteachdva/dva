shader_type spatial;
render_mode unshaded, cull_front;

uniform vec4 base_color : source_color = vec4(1.0, 0.42, 0.08, 1.0);
uniform float speed : hint_range(0.0, 1.0) = 0.15;

// ── 3D value noise (seamless on spheres, no atan wrap) ──────────────────────
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

// Low-frequency, large-blob fbm for lava-lamp feel
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

void fragment() {
    vec3 dir = normalize(VERTEX);
    float t = TIME * speed;

    // Large slow-moving blobs via domain-warped 3D fbm
    vec3 p = dir * 1.6 + vec3(0.0, t * 0.35, 0.0);

    float q1 = fbm3(p + vec3(0.0));
    float q2 = fbm3(p + vec3(5.2, 1.3, 2.8));
    vec3 q = vec3(q1, q2, fbm3(p + vec3(3.1, 7.4, 1.7)));

    float r1 = fbm3(p + q * 1.2 + vec3(1.7, 9.2, 3.1) + t * vec3(0.05, 0.03, 0.04));
    float r2 = fbm3(p + q * 1.2 + vec3(8.3, 2.8, 4.5) + t * vec3(0.04, 0.06, 0.03));
    vec3 r = vec3(r1, r2, 0.0);

    float f = fbm3(p + r * 0.85);

    // Convection: blobs are more coherent and rise near top
    float convection = smoothstep(-0.5, 0.7, dir.y);
    f = mix(f, f * convection + (1.0 - convection) * 0.2, 0.3);

    // ── Blob masks ────────────────────────────────────────────────────────
    float blobs  = smoothstep(0.40, 0.54, f);   // main wax body
    float glow   = smoothstep(0.28, 0.54, f) * 0.25; // soft outer halo
    float core   = smoothstep(0.52, 0.68, f);   // hot bright center

    // ── Palette: dark oil background, warm wax blobs ──────────────────────
    vec3 oil_col  = base_color.rgb * 0.05;          // almost black
    vec3 wax_dark = base_color.rgb * 0.30;
    vec3 wax_mid  = base_color.rgb * 0.75;
    vec3 wax_lit  = min(base_color.rgb * 1.15 + vec3(0.15, 0.10, 0.04), vec3(1.0));
    vec3 wax_core = min(base_color.rgb * 1.6  + vec3(0.28, 0.20, 0.10), vec3(1.0));

    vec3 color = oil_col;
    color = mix(color, wax_dark, blobs * 0.65);
    color = mix(color, wax_mid, glow);
    color = mix(color, wax_lit, blobs * 0.45);
    color = mix(color, wax_core, core * 0.55);

    // Gentle horizon gradient so ground isn't pitch black
    float v = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 horizon = mix(base_color.rgb * 0.02, base_color.rgb * 0.14, smoothstep(0.0, 0.4, v));
    color = mix(horizon, color, 0.72 + blobs * 0.18);

    ALBEDO = color;
}
