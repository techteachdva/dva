shader_type spatial;
render_mode blend_add, depth_draw_opaque, cull_disabled;

// ── Subtle magnetic field ripple ────────────────────────────────────────────
// Expanding concentric rings on a transparent plane above the floor.

uniform vec4 ring_color : source_color = vec4(0.2, 0.85, 0.95, 1.0);
uniform float emission_mult : hint_range(0.0, 2.0) = 0.7;
uniform float ring_speed : hint_range(0.0, 10.0) = 2.5;
uniform float ring_density : hint_range(1.0, 40.0) = 16.0;
uniform float fade_edge : hint_range(0.0, 1.0) = 0.85;

void fragment() {
	vec2 uv = UV - vec2(0.5);
	float dist = length(uv) * 2.0;

	// Expanding rings
	float rings = sin(dist * ring_density - TIME * ring_speed);
	rings = smoothstep(0.25, 0.55, rings);

	// Fade near edges and center
	float fade = smoothstep(1.0, fade_edge, dist) * smoothstep(0.0, 0.15, dist);

	float intensity = rings * fade * 0.5;

	ALBEDO = vec3(0.0);
	EMISSION = ring_color.rgb * intensity * emission_mult;
	ALPHA = intensity * 0.25;
}
