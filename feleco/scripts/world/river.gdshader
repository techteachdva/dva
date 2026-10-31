shader_type spatial;
render_mode blend_mix, depth_draw_opaque, unshaded, cull_disabled, shadows_disabled;

// UV.x runs bank to bank (0..1); UV.y is distance along the river's own curve,
// so everything flows around the bends. Vertex colour: r how steep the bed is
// (0 calm .. 1 rapids), g the bend (0.5 straight; above bends toward UV.x 0),
// b and a the downstream direction. The outer band of the ribbon is the bank.
//
// The water: the deep channel swings to the outside of each bend, leaving a
// shallow sandy point bar on the inside. Current runs fastest over the deep
// channel. Ripples are a real height field drifting downstream; its slope
// bends the light, giving sky reflection, sun glitter and caustics on the bed.
// Two copies cross-fade so the sheared current never smears.

uniform float water_edge = 0.78;
uniform vec3 deep : source_color = vec3(0.02, 0.2, 0.3);
uniform vec3 shallow : source_color = vec3(0.24, 0.62, 0.6);
uniform vec3 sky : source_color = vec3(0.74, 0.87, 0.97);
uniform vec3 horizon : source_color = vec3(0.93, 0.92, 0.84);
uniform vec3 sand : source_color = vec3(0.66, 0.57, 0.4);
uniform vec3 moss : source_color = vec3(0.4, 0.5, 0.26);
uniform vec3 sun_dir = vec3(-0.45, 0.72, 0.52);
// Half the ribbon's width in metres, so ripples are sized in metres.
uniform float half_width = 3.5;
// Both ends fade out where the river runs off into the trees.
uniform float river_length = 100.0;
// 0..1: flood water is brown with silt and carries more foam.
uniform float flood = 0.0;
uniform vec3 silt : source_color = vec3(0.42, 0.38, 0.27);
// 0 = open water, 1 = frozen over: pale, still ice with fish faint beneath.
uniform float ice = 0.0;

varying float v_rapid;
varying float v_bend;
varying vec2 v_down;
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

// Ripples, stretched along the current. p is (metres across, metres along).
float waves(vec2 p) {
	return vnoise(p * vec2(1.5, 0.75)) * 0.62 + vnoise(p * vec2(3.3, 1.6) + 5.2) * 0.38;
}

void vertex() {
	v_rapid = COLOR.r;
	v_bend = COLOR.g * 2.0 - 1.0;
	v_down = COLOR.ba * 2.0 - 1.0;
	// A real swell down the channel, stronger in rapids. The banks never move.
	float su = (UV.x - 0.5) * 2.0;
	float mid = 1.0 - smoothstep(0.1, water_edge, abs(su));
	float s = sin(UV.y * 0.9 - TIME * 2.0) + 0.5 * sin(UV.y * 2.3 + su * 3.0 - TIME * 3.1);
	VERTEX.y += s * 0.035 * mid * (1.0 + v_rapid * 3.0);
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float su = (UV.x - 0.5) * 2.0;
	float u = abs(su);
	float along = UV.y;
	float across = su * half_width;
	// The waterline wanders, and draws back to bare a sand bar inside a bend.
	float side_of = sign(su + 0.0001);
	float inner = smoothstep(0.0, 0.8, -side_of * v_bend);
	float edge = water_edge + (fbm(vec2(along * 0.32, side_of * 5.0)) - 0.5) * 0.17 - inner * 0.2;
	// The deep line swings outward on a bend. The outer bank drops steeply; the
	// inner one shelves away as a point bar.
	float thalweg = clamp(v_bend * 0.42, -0.42, 0.42) * edge;
	float off = su - thalweg;
	float reach = off > 0.0 ? edge - thalweg : edge + thalweg;
	float rel = clamp(off / reach, -1.0, 1.0);
	float depth = 1.0 - rel * rel;
	float speed = (0.3 + 0.7 * depth) * (1.0 + v_rapid * 2.5);

	// Two copies of the ripples, each dragged downstream then reset unseen.
	float t0 = fract(TIME * 0.22);
	float t1 = fract(TIME * 0.22 + 0.5);
	float mix_w = abs(t0 * 2.0 - 1.0);
	vec2 q0 = vec2(across, along - t0 * 5.5 * speed);
	vec2 q1 = vec2(across + 4.3, along - t1 * 5.5 * speed + 11.0);
	float e = 0.12;
	float h = mix(waves(q0), waves(q1), mix_w);
	float hx = mix(waves(q0 + vec2(e, 0.0)), waves(q1 + vec2(e, 0.0)), mix_w);
	float hy = mix(waves(q0 + vec2(0.0, e)), waves(q1 + vec2(0.0, e)), mix_w);
	vec2 slope = vec2(hx - h, hy - h) / e * (0.22 + v_rapid * 0.3);
	vec2 down = normalize(v_down + vec2(0.0001, 0.0));
	vec2 side = vec2(-down.y, down.x);
	vec3 n = normalize(vec3(0.0, 1.0, 0.0) - vec3(side.x, 0.0, side.y) * slope.x - vec3(down.x, 0.0, down.y) * slope.y);

	vec3 to_eye = normalize(CAMERA_POSITION_WORLD - v_world);
	float cos_v = clamp(dot(n, to_eye), 0.0, 1.0);

	// What you see through the water: sand and pebbles, wobbling with the
	// slope, netted with caustics, sinking into green-blue with depth.
	vec2 b = vec2(across, along) + slope * 0.5;
	float pebbles = fbm(b * 1.7);
	vec3 bed = sand * (0.72 + pebbles * 0.5);
	float net = vnoise(b * 1.6 + vec2(TIME * 0.25, -TIME * 0.5)) + vnoise(b * 1.6 + 4.0 - vec2(TIME * 0.2, -TIME * 0.35));
	float caustic = pow(1.0 - abs(net - 1.0), 7.0);
	bed += vec3(0.5, 0.55, 0.45) * caustic * (1.0 - depth) * 0.75;
	float clarity = pow(1.0 - depth, 1.6);
	vec3 col = mix(mix(deep, shallow, smoothstep(0.0, 0.55, 1.0 - depth)), bed, clarity * 0.85);

	// The sky, bent by the ripples and strongest at low angles.
	vec3 r = reflect(-to_eye, n);
	vec3 sky_col = mix(horizon, sky, clamp(r.y * 1.4, 0.0, 1.0));
	float fresnel = 0.03 + 0.97 * pow(1.0 - cos_v, 4.0);
	col = mix(col, sky_col, clamp(fresnel * 0.9 + 0.05, 0.0, 0.85));

	// The current's long lines, drawn around the bend.
	float s0 = fbm(vec2(across * 2.6, along * 0.26 - t0 * 2.2 * speed));
	float s1 = fbm(vec2(across * 2.6 + 3.1, along * 0.26 - t1 * 2.2 * speed + 6.0));
	float streak = smoothstep(0.56, 0.78, mix(s0, s1, mix_w));
	col += vec3(0.42, 0.56, 0.6) * streak * 0.22 * depth;

	// Sun glitter on the slopes that face it.
	vec3 sun = normalize(sun_dir);
	float spec = pow(clamp(dot(r, sun), 0.0, 1.0), 140.0);
	float sparkle = pow(clamp(dot(r, sun), 0.0, 1.0), 26.0) * smoothstep(0.58, 0.72, h);
	col += vec3(1.0, 0.97, 0.88) * (spec * 1.6 + sparkle * 0.5);

	// The cut bank shades the water beneath it on the outside of a bend.
	float outer = smoothstep(0.35, 1.0, su * sign(v_bend + 0.0001) / edge) * abs(v_bend);
	col *= 1.0 - outer * 0.32;

	// Foam: lacy along the waterline, thicker where the current hits the
	// outer bank, white in rapids.
	float f0 = fbm(vec2(across * 3.0, along * 1.1 - t0 * 3.2 * speed));
	float f1 = fbm(vec2(across * 3.0 + 2.0, along * 1.1 - t1 * 3.2 * speed + 3.0));
	float foam_n = mix(f0, f1, mix_w);
	float shore = smoothstep(edge - 0.14 - outer * 0.1, edge - 0.015, u) * (1.0 - smoothstep(edge - 0.01, edge + 0.015, u));
	float foam = shore * smoothstep(0.42 - outer * 0.14, 0.66, foam_n);
	float white = v_rapid * smoothstep(0.5 - v_rapid * 0.25, 0.85, h * 0.6 + foam_n * 0.5);
	foam = max(foam, white);
	foam = max(foam, flood * 0.3 * smoothstep(0.6, 0.9, foam_n));
	col = mix(col, vec3(0.93, 0.97, 0.98), clamp(foam, 0.0, 1.0) * 0.85);

	float alpha = mix(0.72, 0.97, depth) + foam * 0.1;
	col = mix(col, silt + vec3(streak * 0.25), flood * 0.75);
	alpha = mix(alpha, 0.97, flood);
	if (ice > 0.0) {
		float crack = smoothstep(0.93, 1.0, abs(sin(along * 0.9 + UV.x * 7.0) * sin(along * 0.37 - UV.x * 13.0)));
		vec3 frost = mix(vec3(0.78, 0.88, 0.95), vec3(0.93, 0.97, 1.0), smoothstep(0.0, edge, u));
		frost = mix(frost, vec3(0.55, 0.68, 0.8), crack * 0.6);
		frost += vec3(0.06) * fresnel;
		col = mix(col, frost, ice);
		alpha = mix(alpha, 0.8, ice);
	}
	if (u > edge) {
		float k = (u - edge) / (1.0 - edge);
		// Wet dark sand at the waterline, pale dry shingle, then moss. The bank
		// is lit like a slope climbing away from the water.
		float grit = fbm(vec2(across, along) * 3.0);
		vec3 wet = sand * mix(0.5, 1.08, smoothstep(0.0, 0.42, k)) * (0.84 + grit * 0.32);
		col = mix(wet, moss, smoothstep(0.35, 1.0, k + (grit - 0.5) * 0.4));
		alpha = 1.0 - smoothstep(0.5, 0.98, k + (grit - 0.5) * 0.5);
	}
	alpha *= smoothstep(0.0, 10.0, along) * smoothstep(0.0, 10.0, river_length - along);
	ALBEDO = col;
	ALPHA = clamp(alpha, 0.0, 1.0);
}
