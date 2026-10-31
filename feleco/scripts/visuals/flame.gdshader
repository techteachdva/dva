shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

// A living flame on a camera-facing quad: licking tongues over a soft teardrop,
// white at the heart, through gold and orange to a red rim.

varying float v_seed;

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5);
	float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
	float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5);
	float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void vertex() {
	vec3 world = MODEL_MATRIX[3].xyz;
	v_seed = fract(world.x * 0.37 + world.z * 0.61) * 40.0;
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], vec4(0, 1, 0, 0), INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

void fragment() {
	vec2 p = vec2(UV.x - 0.5, 1.0 - UV.y);
	float t = TIME * 2.4 + v_seed;
	// Rising turbulence bends the shape more the higher it climbs.
	float n = noise(vec2(p.x * 5.0 + v_seed, p.y * 4.0 - t * 1.6));
	float n2 = noise(vec2(p.x * 11.0 - v_seed, p.y * 8.0 - t * 2.6));
	p.x += (n - 0.5) * 0.38 * p.y;
	float width = 0.42 * (1.0 - p.y) * sqrt(max(p.y, 0.0) * 3.0 + 0.04);
	float body = 1.0 - smoothstep(width * 0.35, width, abs(p.x));
	body *= 1.0 - smoothstep(0.55, 1.0, p.y + (n2 - 0.5) * 0.35);
	body *= smoothstep(0.0, 0.08, p.y);
	float heat = body * (1.0 - p.y * 0.75);
	vec3 col = mix(vec3(0.72, 0.08, 0.02), vec3(0.98, 0.36, 0.04), smoothstep(0.05, 0.35, heat));
	col = mix(col, vec3(1.0, 0.68, 0.12), smoothstep(0.35, 0.65, heat));
	col = mix(col, vec3(1.0, 0.93, 0.6), smoothstep(0.72, 0.95, heat));
	ALBEDO = col;
	ALPHA = clamp(body * 1.25, 0.0, 1.0);
}
