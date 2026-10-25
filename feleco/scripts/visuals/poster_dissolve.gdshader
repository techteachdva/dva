shader_type canvas_item;

// Per-grain birth time in [0,1] (edges low, so they blow away first).
uniform sampler2D mask : filter_nearest;
uniform float t = 0.0;
uniform float span = 1.4;

void fragment() {
	float w = clamp(t / 0.5, 0.0, 1.0);
	vec2 uv = UV + vec2(sin(UV.y * 22.0 + TIME * 5.0), cos(UV.x * 17.0 + TIME * 4.0)) * 0.006 * w;
	vec4 c = texture(TEXTURE, uv);
	float m = texture(mask, UV).r;
	float front = t / span;
	float near = 1.0 - smoothstep(0.0, 0.045, m - front);
	c.rgb = mix(c.rgb, c.rgb * 1.25 + vec3(0.35, 0.26, 0.1), near * step(0.0001, t));
	c.a *= step(front, m);
	COLOR = c;
}
