shader_type spatial;
render_mode blend_mix, cull_disabled, unshaded, shadows_disabled, depth_draw_never;

varying vec3 opos;

void vertex() {
	opos = VERTEX;
}

void fragment() {
	vec3 n = normalize(NORMAL);
	vec3 view = normalize(VIEW);
	float facing = clamp(dot(n, view), 0.0, 1.0);
	float fres = pow(1.0 - facing, 1.6);
	vec3 skin = mix(vec3(0.55, 0.78, 0.95), vec3(0.96, 0.90, 0.82), pow(facing, 1.4));
	vec3 col = skin + vec3(0.12, 0.22, 0.4) * fres;
	// A fine grain stuck to the mesh. World-space cells turned the palm into
	// a few giant pixels and hid the creature behind an opaque slab.
	// WebGL rejects dot(vec3, vec2); the cell is a point on the hand.
	vec3 cell = floor(opos * 22.0);
	float gate = step(0.62, fract(sin(dot(cell, vec3(19.1, 73.4, 41.7))) * 43758.5));
	vec3 pix = floor(col * 8.0) / 8.0;
	col = mix(col, pix, gate * 0.35);
	float scan = step(0.82, fract(opos.y * 10.0 - TIME * 0.25));
	col += vec3(0.25, 0.45, 0.7) * scan * 0.12;
	ALBEDO = col;
	ALPHA = 0.42 + fres * 0.4;
}
