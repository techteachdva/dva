shader_type canvas_item;

// The menu poster: the centre column is quieted a touch so the menu reads
// over the picture, with a gentle vignette; `fade` cross-fades the seasons.

uniform float fade = 1.0;

void fragment() {
	vec4 base = texture(TEXTURE, UV);
	vec3 col = base.rgb;
	float centre = 1.0 - smoothstep(0.12, 0.34, abs(UV.x - 0.5));
	col *= 1.0 - centre * 0.28;
	vec2 v = UV - 0.5;
	col *= 1.0 - dot(v, v) * 0.7;
	COLOR = vec4(col, base.a * fade);
}
