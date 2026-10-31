shader_type spatial;
render_mode unshaded, cull_front, blend_add, depth_draw_never, shadows_disabled;

// A soft halo of light around the hand: the mesh grown a touch, inside out.

uniform float width = 0.03;
uniform float fade_from = 0.0;
uniform float fade_to = 0.0;

varying vec3 local;

void vertex() {
	local = VERTEX;
	VERTEX += NORMAL * width;
}

void fragment() {
	float fade = 1.0;
	if (fade_to > fade_from) {
		fade = 1.0 - smoothstep(fade_from, fade_to, local.y);
	}
	ALBEDO = vec3(0.34, 0.6, 1.0);
	ALPHA = 0.32 * fade;
}
