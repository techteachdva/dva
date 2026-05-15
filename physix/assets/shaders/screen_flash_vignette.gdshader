shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 0.0);
uniform float intensity : hint_range(0.0, 1.0) = 0.0;
uniform float radius : hint_range(0.0, 2.0) = 1.2;
uniform float softness : hint_range(0.0, 1.0) = 0.6;

void fragment() {
	vec2 uv = UV - 0.5;
	float dist = length(uv) * 2.0;
	float vignette = smoothstep(radius - softness, radius, dist);
	COLOR = vec4(flash_color.rgb, flash_color.a * vignette * intensity);
}