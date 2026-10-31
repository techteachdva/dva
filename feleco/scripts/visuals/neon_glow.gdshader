shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;

// A pool of light: white-hot in the middle, neon blooming out to nothing, stars
// adrift in it. Faces the camera, or lies flat on the ground when flat is set.

#include "res://scripts/visuals/radiant.gdshaderinc"

uniform float flat_on_ground = 0.0;
uniform float strength = 1.0;
uniform float star_cells = 5.0;

void vertex() {
	if (flat_on_ground < 0.5) {
		MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
		MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
	}
}

void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float r = length(p);
	float falloff = pow(clamp(1.0 - r, 0.0, 1.0), 1.7);
	vec3 col = radiant_flow(p * 1.5, TIME);
	col = mix(col, vec3(1.0, 0.96, 1.0), pow(clamp(1.0 - r * 2.6, 0.0, 1.0), 2.0) * 0.9);
	float stars = radiant_stars(p + vec2(TIME * 0.02, -TIME * 0.03), star_cells, TIME) * smoothstep(1.0, 0.45, r);
	ALBEDO = col + vec3(stars);
	ALPHA = clamp((falloff + stars) * strength, 0.0, 1.0);
}
