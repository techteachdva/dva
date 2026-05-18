shader_type spatial;
render_mode blend_mix, depth_draw_opaque;

// ── Holographic fresnel iridescence ─────────────────────────────────────────
// Surface looks like dark polished oil / obsidian with prismatic edge-glow.

uniform vec4 base_color : source_color = vec4(0.04, 0.04, 0.06, 0.5);
uniform float fresnel_power : hint_range(0.5, 5.0) = 2.2;
uniform float emission_mult : hint_range(0.0, 3.0) = 1.1;
uniform float color_shift_speed : hint_range(0.0, 2.0) = 0.12;
uniform float ripple_scale : hint_range(0.0, 20.0) = 4.0;
uniform float ripple_strength : hint_range(0.0, 1.0) = 0.06;

// Inigo Quilez cosine palette: generates smooth spectral gradients
vec3 spectral(float t) {
	vec3 a = vec3(0.5, 0.5, 0.5);
	vec3 b = vec3(0.5, 0.5, 0.5);
	vec3 c = vec3(1.0, 1.0, 1.0);
	vec3 d = vec3(0.00, 0.33, 0.67);
	return a + b * cos(6.28318 * (c * t + d));
}

void fragment() {
	// Subtle surface ripple from world-space sine waves
	vec3 world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float ripple = sin(world_pos.x * ripple_scale + TIME * 0.7) *
	               sin(world_pos.z * ripple_scale * 0.7 + TIME * 0.5) *
	               ripple_strength;

	// Fresnel: strong at grazing angles, fades at center
	float ndotv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float fresnel = pow(1.0 - ndotv, fresnel_power);

	// Spectral color shifts slowly over time
	vec3 irid = spectral(fresnel * 2.0 + TIME * color_shift_speed + ripple);

	vec3 color = base_color.rgb + irid * fresnel * emission_mult;
	float rim = smoothstep(0.55, 1.0, fresnel);

	ALBEDO = color;
	EMISSION = irid * fresnel * emission_mult * (0.65 + rim * 0.25);
	METALLIC = 0.82;
	ROUGHNESS = mix(0.22, 0.12, rim);
	SPECULAR = 0.55 + rim * 0.2;
	ALPHA = base_color.a;
}
