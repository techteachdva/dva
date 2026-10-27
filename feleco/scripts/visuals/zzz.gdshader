shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, depth_draw_never;

// A small "z" drifting up off a sleeping creature, drawn from three strokes
// (top bar, diagonal, bottom bar) so it needs no texture. Billboarded; the
// instance colour's alpha fades it in and out.

varying float v_alpha;

void vertex() {
	v_alpha = COLOR.a;
	float sx = length(MODEL_MATRIX[0].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * sx, INV_VIEW_MATRIX[1] * sx, INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
}

float seg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

void fragment() {
	vec2 p = UV;
	float d = min(seg(p, vec2(0.22, 0.2), vec2(0.78, 0.2)), seg(p, vec2(0.78, 0.2), vec2(0.22, 0.8)));
	d = min(d, seg(p, vec2(0.22, 0.8), vec2(0.78, 0.8)));
	float ink = 1.0 - smoothstep(0.06, 0.1, d);
	ALBEDO = vec3(0.92, 0.95, 1.0);
	ALPHA = ink * v_alpha;
}
