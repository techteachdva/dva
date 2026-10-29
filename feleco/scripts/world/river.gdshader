shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

// UV.x runs bank to bank (0..1); UV.y is distance along the river in world units.
// COLOR.r is how steep the bed is there (0 calm .. 1 rapids), set per vertex.
// The outer band of the ribbon is a sandy bank that fades into the meadow.
//
// The water (4.7): two layers of flowing noise drift downstream at different
// speeds (the faster one in the middle of the channel), bending a fake sky
// reflection that brightens at grazing angles. Shallows show the sandy bed
// through the water, the banks fizz with broken foam, rapids run fast and
// white, and the sun sparkles off the ripples.

uniform float water_edge = 0.78;
uniform vec3 deep : source_color = vec3(0.07, 0.27, 0.45);
uniform vec3 shallow : source_color = vec3(0.24, 0.56, 0.62);
uniform vec3 sky : source_color = vec3(0.72, 0.86, 0.96);
uniform vec3 sand : source_color = vec3(0.6, 0.52, 0.36);
uniform vec3 moss : source_color = vec3(0.4, 0.5, 0.26);
// Both ends fade out where the river runs off into the peaks.
uniform float river_length = 100.0;
// 0..1: flood water is brown with silt and carries more foam.
uniform float flood = 0.0;
uniform vec3 silt : source_color = vec3(0.42, 0.38, 0.27);
// 0 = open water, 1 = frozen over: pale, still ice with fish faint beneath.
uniform float ice = 0.0;

varying float v_rapid;
varying vec3 v_world;

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
	return vnoise(p) * 0.55 + vnoise(p * 2.13 + 7.1) * 0.3 + vnoise(p * 4.7 + 3.3) * 0.15;
}

void vertex() {
	v_rapid = COLOR.r;
	// A gentle swell, stronger in the rapids. Never moves the banks.
	float mid = 1.0 - abs(UV.x - 0.5) * 2.0;
	VERTEX.y += sin(UV.y * 0.8 - TIME * 2.2) * 0.03 * mid * (1.0 + v_rapid * 3.0);
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float u = abs(UV.x - 0.5) * 2.0;
	float across = (UV.x - 0.5) * 6.0;
	float v = UV.y;
	// Flow speed: fastest mid-channel, slow by the banks, quicker in rapids.
	float speed = (1.0 - u * u * 0.7) * (1.0 + v_rapid * 2.5);
	vec2 p1 = vec2(across * 1.3, v * 0.55 - TIME * 1.6 * speed);
	vec2 p2 = vec2(across * 2.1 + 3.0, v * 0.9 - TIME * 2.4 * speed);
	float n1 = fbm(p1);
	float n2 = fbm(p2);
	float ripple = n1 * 0.6 + n2 * 0.4;
	// Depth: deep down the middle, shallow by the banks, and the sandy bed
	// showing through in the shallows (wobbling with the ripples).
	float depth = 1.0 - smoothstep(0.0, water_edge, u);
	vec3 bed = mix(sand * 0.85, shallow, 0.55) + (ripple - 0.5) * 0.08;
	vec3 col = mix(bed, mix(shallow, deep, depth), smoothstep(0.0, 0.5, depth));
	// The sky's reflection, bent by the ripples, brighter at grazing angles.
	vec3 view_dir = normalize(CAMERA_POSITION_WORLD - v_world);
	float graze = 1.0 - clamp(view_dir.y, 0.0, 1.0);
	float fresnel = 0.12 + 0.6 * pow(graze, 3.0);
	float sheen = smoothstep(0.45, 0.85, ripple);
	col = mix(col, sky, clamp(fresnel * (0.6 + sheen * 0.8), 0.0, 0.85));
	// Long streaks drawn downstream by the current.
	float streak = smoothstep(0.62, 0.9, fbm(vec2(across * 4.0, v * 0.18 - TIME * 0.9 * speed)));
	col += vec3(0.5, 0.65, 0.7) * streak * 0.18 * (1.0 - u);
	// Sun sparkle: tiny bright points where two ripple layers peak together.
	float glint = smoothstep(0.86, 0.95, n1 * n2 * 1.7) * (0.4 + graze);
	col += vec3(1.0, 0.98, 0.9) * glint * 0.7;
	// Foam: a broken, fizzing line along each bank, and white water in rapids.
	float edge_band = smoothstep(water_edge - 0.2, water_edge - 0.02, u) * (1.0 - smoothstep(water_edge - 0.01, water_edge + 0.02, u));
	float foam_n = fbm(vec2(across * 6.0, v * 1.4 - TIME * 1.1 * speed));
	float foam = edge_band * smoothstep(0.35, 0.7, foam_n);
	float white = v_rapid * smoothstep(0.5 - v_rapid * 0.25, 0.85, n2 * 0.6 + foam_n * 0.5);
	foam = max(foam, white);
	foam = max(foam, flood * 0.3 * smoothstep(0.6, 0.9, foam_n));
	col = mix(col, vec3(0.93, 0.97, 0.98), clamp(foam, 0.0, 1.0) * 0.85);
	float alpha = mix(0.8, 0.93, depth) + foam * 0.1;
	col = mix(col, silt + vec3(streak * 0.25), flood * 0.75);
	alpha = mix(alpha, 0.95, flood);
	if (ice > 0.0) {
		float crack = smoothstep(0.93, 1.0, abs(sin(v * 0.9 + UV.x * 7.0) * sin(v * 0.37 - UV.x * 13.0)));
		vec3 frost = mix(vec3(0.78, 0.88, 0.95), vec3(0.93, 0.97, 1.0), smoothstep(0.0, water_edge, u));
		frost = mix(frost, vec3(0.55, 0.68, 0.8), crack * 0.6);
		frost += vec3(0.06) * fresnel;
		col = mix(col, frost, ice);
		alpha = mix(alpha, 0.74, ice);
	}
	if (u > water_edge) {
		float b = (u - water_edge) / (1.0 - water_edge);
		// Wet, darker sand at the waterline, drying out into the moss.
		vec3 wet = sand * mix(0.7, 1.0, smoothstep(0.0, 0.35, b));
		col = mix(wet, moss, smoothstep(0.2, 1.0, b));
		alpha = 1.0 - smoothstep(0.45, 1.0, b);
	}
	alpha *= smoothstep(0.0, 18.0, v) * smoothstep(0.0, 18.0, river_length - v);
	ALBEDO = col;
	ALPHA = clamp(alpha, 0.0, 1.0);
}
