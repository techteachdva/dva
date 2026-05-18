shader_type spatial;
render_mode blend_add, depth_draw_opaque, cull_disabled;

// ── Magnetic field line visual ──────────────────────────────────────────────
// Faint grid lines that pulse and drift, evoking iron-filing field patterns.

uniform vec4 ring_color : source_color = vec4(0.2, 0.85, 0.95, 1.0);
uniform float emission_mult : hint_range(0.0, 2.0) = 0.7;
uniform float line_speed : hint_range(0.0, 10.0) = 1.5;
uniform float line_density : hint_range(1.0, 40.0) = 12.0;
uniform float fade_edge : hint_range(0.0, 1.0) = 0.85;

void fragment() {
	vec2 uv = UV - vec2(0.5);
	float dist = length(uv) * 2.0;

	// Concentric rings (old behavior, kept subtle)
	float rings = sin(dist * line_density - TIME * line_speed);
	rings = smoothstep(0.25, 0.55, rings);

	// Faint cross-hatch field lines
	float lines_x = sin((uv.x + uv.y * 0.3) * line_density * 1.5 + TIME * line_speed * 0.7);
	float lines_y = sin((uv.y - uv.x * 0.3) * line_density * 1.5 - TIME * line_speed * 0.5);
	float field_grid = smoothstep(0.35, 0.65, lines_x) * 0.35 + smoothstep(0.35, 0.65, lines_y) * 0.35;

	// Fade near edges and center
	float fade = smoothstep(1.0, fade_edge, dist) * smoothstep(0.0, 0.15, dist);

	float intensity = (rings * 0.4 + field_grid) * fade;

	ALBEDO = vec3(0.0);
	EMISSION = ring_color.rgb * intensity * emission_mult;
	ALPHA = intensity * 0.3;
}
