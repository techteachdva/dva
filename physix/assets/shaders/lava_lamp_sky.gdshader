shader_type spatial;
render_mode unshaded, cull_front;

uniform vec4 base_color : source_color = vec4(1.0, 0.42, 0.08, 1.0);
uniform float speed : hint_range(0.0, 1.0) = 0.15;
uniform float emission_strength : hint_range(0.0, 2.0) = 0.32;
uniform float color_contrast : hint_range(0.8, 1.6) = 1.28;
uniform float wash_guard : hint_range(0.5, 1.2) = 0.78;
uniform int mode : hint_range(0, 3) = 0; // 0=lava, 1=neon-grid, 2=space, 3=nature

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

// Low-frequency, large-blob fbm
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

    vec3 color = vec3(0.0);
    vec3 emiss = vec3(0.0);

    if (mode == 1) {
        // ── Neon Nights: Tron horizon grid on a dark night sky ──────────────
        float v = dir.y;

        // Night sky — faint cyan tint near horizon, pure black above
        float sky_blend = smoothstep(-0.05, 0.45, v);
        vec3 col = mix(base_color.rgb * 0.06, vec3(0.0), sky_blend);

        // Soft horizon glow band
        float horizon = smoothstep(0.08, 0.0, abs(v));
        col += base_color.rgb * horizon * 0.5;

        // Ground grid: intersect a plane below the camera
        if (v < -0.02) {
            float cam_h = 2.0;
            float td = -cam_h / v;
            td = min(td, 120.0);
            vec2 gp = dir.xz * td;

            // Static grid — no scroll
            float density = 1.0;
            float gx = abs(cos(gp.x * PI * density));
            float gz = abs(cos(gp.y * PI * density));
            float major = max(smoothstep(0.97, 1.0, gx), smoothstep(0.97, 1.0, gz));

            // Fainter minor grid
            float gx2 = abs(cos(gp.x * PI * density * 4.0));
            float gz2 = abs(cos(gp.y * PI * density * 4.0));
            float minor = max(smoothstep(0.995, 1.0, gx2), smoothstep(0.995, 1.0, gz2)) * 0.35;

            float line = max(major, minor);

            // Distance fog fade
            float fade = exp(-td * 0.065);

            col += base_color.rgb * line * emission_strength * fade * 3.5;
        }

        // Bright horizon line where grid meets sky
        float hline = smoothstep(0.03, 0.0, abs(v));
        col += base_color.rgb * hline * emission_strength * 2.2;

        col = min(col, vec3(wash_guard));
        color = col;
        emiss = col * emission_strength * 0.5;
    } else if (mode == 2) {
        // ── Space: starfield + nebula + comet trails ────────────────────────
        vec3 col = base_color.rgb * 0.012;

        // Two-layer starfield with twinkle
        vec3 seed1 = floor(dir * 200.0);
        vec3 seed2 = floor(dir * 130.0 + vec3(13.7, 5.3, 8.1));
        float bright = step(0.998, hash3(seed1));
        float dim    = step(0.985, hash3(seed2)) * 0.45;
        float twinkle = 0.6 + 0.4 * sin(TIME * 3.0 + hash3(seed1) * 6.283);
        float stars = (bright + dim) * twinkle;

        col += vec3(0.95, 0.92, 0.88) * stars * emission_strength;

        // Nebula clouds (subtle, tinted by base_color)
        float neb = fbm3(dir * 1.8 + vec3(2.3, 1.1, 4.7));
        neb = smoothstep(0.35, 0.65, neb) * 0.5;
        col += base_color.rgb * neb * emission_strength * 0.6;

        // Comet trails
        float comet1 = smoothstep(0.025, 0.0, abs(fract(dir.y * 2.2 + dir.x * 1.4 + t * 0.07) - 0.5));
        float comet2 = smoothstep(0.025, 0.0, abs(fract(dir.y * 1.6 - dir.x * 2.1 + t * 0.05 + 0.43) - 0.5));
        float comet3 = smoothstep(0.025, 0.0, abs(fract(dir.y * 1.1 + dir.x * 2.8 + t * 0.04 + 0.79) - 0.5));
        col += base_color.rgb * (comet1 * 0.5 + comet2 * 0.35 + comet3 * 0.25) * 0.7;

        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, color_contrast);
        col = min(col, vec3(wash_guard));
        color = col;
        emiss = vec3(bright * emission_strength * 0.9 + neb * emission_strength * 0.25);
    } else if (mode == 3) {
        // ── Nature: sunny sky with soft clouds ──────────────────────────────
        float v = dir.y;
        vec3 col = vec3(0.0);

        // Sky gradient: deep blue above, light cyan near horizon
        vec3 sky_top  = base_color.rgb * 0.55;
        vec3 sky_hori = vec3(0.72, 0.84, 0.94);
        float height  = smoothstep(-0.25, 0.75, v);
        col = mix(sky_hori, sky_top, height);

        // Soft clouds drifting slowly
        float ct = t * 0.25;
        vec3 cp = dir * 1.3 + vec3(ct * 0.25, 0.0, ct * 0.12);
        float clouds = fbm3(cp + vec3(5.1, 3.7, 1.3));
        clouds = smoothstep(0.50, 0.70, clouds);
        col = mix(col, vec3(1.0, 0.99, 0.97), clouds * 0.65);

        // Sun disc + soft glow
        vec3 sun_dir = normalize(vec3(0.35, 0.42, -0.8));
        float sun_dot = max(dot(dir, sun_dir), 0.0);
        float sun_disc = pow(sun_dot, 160.0);
        float sun_glow = pow(sun_dot, 6.0) * 0.25;
        vec3 sun_col = vec3(1.0, 0.96, 0.85);
        col += sun_col * (sun_disc * 0.9 + sun_glow);

        // Warm sunset tint near the horizon edges
        float sunset = smoothstep(0.2, -0.15, v) * smoothstep(0.0, 0.5, abs(dir.x));
        col = mix(col, vec3(1.0, 0.70, 0.50), sunset * 0.16);

        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, color_contrast);
        col = min(col, vec3(wash_guard));
        color = col;
        emiss = vec3(sun_disc * emission_strength * 0.55);
    } else {
        // ── Default / Lava lamp: slow domain-warped blobs ───────────────────
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

        // Blob masks (slightly sharper edges = more lava-lamp separation)
        float blobs  = smoothstep(0.38, 0.56, f);
        float glow   = smoothstep(0.26, 0.52, f) * 0.22;
        float core   = smoothstep(0.54, 0.70, f);

        // Palette: deep oil background, saturated wax blobs
        vec3 oil_col  = base_color.rgb * 0.018;
        vec3 wax_dark = base_color.rgb * 0.26;
        vec3 wax_mid  = base_color.rgb * 0.68;
        vec3 wax_lit  = min(base_color.rgb * 1.08 + vec3(0.10, 0.07, 0.03), vec3(0.92));
        vec3 wax_core = min(base_color.rgb * 1.45 + vec3(0.22, 0.16, 0.08), vec3(1.0));

        vec3 col = oil_col;
        col = mix(col, wax_dark, blobs * 0.70);
        col = mix(col, wax_mid, glow);
        col = mix(col, wax_lit, blobs * 0.48);
        col = mix(col, wax_core, core * 0.62);

        // Subtle horizon — keep gaps dark so blobs read clearly
        float v = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = mix(base_color.rgb * 0.012, base_color.rgb * 0.08, smoothstep(0.0, 0.35, v));
        col = mix(horizon, col, 0.86 + blobs * 0.12);

        // Punch contrast; cap peak brightness
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(luma), col, color_contrast);
        col = min(col, vec3(wash_guard));

        color = col;
        // Bloom only on hot cores
        emiss = wax_core * emission_strength * (0.25 + core * 0.75);
    }

    ALBEDO = color;
    EMISSION = emiss;
}
