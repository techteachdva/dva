shader_type spatial;
render_mode unshaded, cull_back, depth_prepass_alpha;

// The god's hand: made of blue light, not flesh. Soft bands give it form, a
// bright rim burns around the edge, slow light moves inside it, and the arm
// thins away to nothing as it rises.

uniform vec3 base : source_color = vec3(0.3, 0.56, 0.96);
uniform vec3 shade : source_color = vec3(0.11, 0.2, 0.62);
uniform vec3 lit : source_color = vec3(0.62, 0.86, 1.0);
uniform vec3 rim_col : source_color = vec3(0.82, 0.96, 1.0);
uniform float alpha_body = 0.93;
// Local height where the arm starts to fade, and where it is gone. Equal: no fade.
uniform float fade_from = 0.0;
uniform float fade_to = 0.0;

varying vec3 local;

void vertex() {
	local = VERTEX;
}

void fragment() {
	vec3 n = normalize(NORMAL);
	vec3 light = normalize((VIEW_MATRIX * vec4(-0.45, 0.8, 0.4, 0.0)).xyz);
	float d = dot(n, light);
	float band = smoothstep(-0.3, 0.1, d) * 0.5 + smoothstep(0.45, 0.7, d) * 0.5;
	vec3 col = band < 0.5 ? mix(shade, base, band * 2.0) : mix(base, lit, band * 2.0 - 1.0);
	float flow = 0.5 + 0.5 * sin(local.y * 7.0 + local.x * 4.0 - TIME * 1.6);
	col += vec3(0.1, 0.2, 0.36) * flow * flow * 0.5;
	float rim = pow(1.0 - clamp(dot(n, normalize(VIEW)), 0.0, 1.0), 3.4);
	col = mix(col, rim_col, rim * 0.5);
	float fade = 1.0;
	if (fade_to > fade_from) {
		fade = 1.0 - smoothstep(fade_from, fade_to, local.y);
	}
	ALBEDO = col;
	ALPHA = (alpha_body + rim * 0.07) * fade;
}
