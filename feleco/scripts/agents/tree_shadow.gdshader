shader_type spatial;
render_mode unshaded, depth_draw_never, cull_disabled, shadows_disabled;

// A tree's painted ground shadow. The quad is stretched away from the sun
// in the vertex stage (one shared material, so moving the sun moves every
// tree's shadow for free): a round pool under the crown at noon, a long
// soft shadow at dawn and dusk, almost nothing by moonlight.

uniform sampler2D blob : source_color, filter_linear;
uniform vec2 sun_dir = vec2(0.0, 1.0);
uniform float stretch = 0.6;
uniform float fade = 1.0;

void vertex() {
	vec2 d = normalize(sun_dir);
	vec2 side = vec2(-d.y, d.x);
	// Local quad: x across the shadow, z along it (-0.5 at the trunk end).
	float along = (VERTEX.z + 0.5) * (1.0 + stretch * 1.6) - 0.5;
	vec2 p = side * VERTEX.x * 0.9 + d * along;
	VERTEX.xz = p;
}

void fragment() {
	float a = texture(blob, UV).a;
	ALBEDO = vec3(0.05, 0.08, 0.04);
	ALPHA = a * 0.34 * fade / (1.0 + stretch * 0.4);
}
