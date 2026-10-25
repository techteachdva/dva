shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

// UV.x runs bank to bank (0..1); UV.y is distance along the river in world units.
// The outer band of the ribbon is a sandy bank that fades into the meadow.

uniform float water_edge = 0.78;
uniform vec3 deep : source_color = vec3(0.09, 0.33, 0.55);
uniform vec3 shallow : source_color = vec3(0.3, 0.62, 0.74);
uniform vec3 sand : source_color = vec3(0.6, 0.52, 0.36);
uniform vec3 moss : source_color = vec3(0.4, 0.5, 0.26);
// Both ends fade out where the river runs off into the copses.
uniform float river_length = 100.0;
// 0..1: flood water is brown with silt and carries more foam.
uniform float flood = 0.0;
uniform vec3 silt : source_color = vec3(0.42, 0.38, 0.27);

void fragment() {
	float u = abs(UV.x - 0.5) * 2.0;
	float v = UV.y;
	vec3 col = mix(deep, shallow, smoothstep(0.0, water_edge, u));
	float wobble = sin(UV.x * 9.0 + v * 0.7) * 1.4;
	float s1 = sin(v * 1.9 - TIME * 2.6 + wobble);
	float s2 = sin(v * 1.1 - TIME * 1.7 + UV.x * 11.0);
	float streak = smoothstep(0.72, 1.0, s1 * s2);
	col += vec3(0.55, 0.7, 0.75) * streak * 0.32 * (1.0 - u);
	float glint = smoothstep(0.985, 1.0, sin(v * 3.7 - TIME * 3.3 + UV.x * 23.0) * sin(UV.x * 31.0 + TIME));
	col += vec3(0.9) * glint * 0.5;
	float foam = smoothstep(water_edge - 0.14, water_edge - 0.02, u) * (1.0 - smoothstep(water_edge - 0.01, water_edge + 0.02, u));
	foam *= 0.65 + 0.35 * sin(v * 2.3 - TIME * 1.2);
	col = mix(col, vec3(0.92, 0.96, 0.96), foam * 0.75);
	float alpha = 0.86;
	col = mix(col, silt + vec3(streak * 0.25), flood * 0.75);
	alpha = mix(alpha, 0.95, flood);
	if (u > water_edge) {
		float b = (u - water_edge) / (1.0 - water_edge);
		col = mix(sand, moss, b);
		alpha = 1.0 - smoothstep(0.45, 1.0, b);
	}
	alpha *= smoothstep(0.0, 10.0, v) * smoothstep(0.0, 10.0, river_length - v);
	ALBEDO = col;
	ALPHA = alpha;
}
