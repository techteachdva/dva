shader_type spatial;
render_mode blend_mix, cull_disabled, unshaded, shadows_disabled, depth_draw_opaque;

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 n = normalize(NORMAL);
	vec3 view = normalize(VIEW);
	float facing = clamp(dot(n, view), 0.0, 1.0);
	float fres = pow(1.0 - facing, 1.7);
	vec3 skin = mix(vec3(0.45, 0.72, 0.98), vec3(1.0, 0.93, 0.86), pow(facing, 1.6));
	vec3 col = skin + vec3(0.28, 0.16, 0.45) * fres;
	// Half the surface stays smooth. The other half locks to big pixels that
	// stick to the hand, so the pattern does not swim across the screen.
	// WebGL rejects dot(vec3, vec2); the cell is a 3D point on the hand.
	vec3 cell = floor(wpos * 7.0);
	float gate = step(0.48, fract(sin(dot(cell, vec3(19.1, 73.4, 41.7))) * 43758.5));
	vec3 pix = floor(col * 5.0) / 5.0;
	col = mix(col, pix, gate);
	float scan = step(0.72, fract(wpos.y * 6.0 - TIME * 0.25));
	col += vec3(0.2, 0.4, 0.65) * scan * 0.18;
	ALBEDO = col;
	ALPHA = 0.82 + fres * 0.16;
}
