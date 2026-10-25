shader_type canvas_item;

// Graphic-novel impact lines fanning out from behind a menu button. The
// rect is the button grown on every side; the button itself covers the
// middle, so only the rays show around its edge. They slowly breathe and turn.

uniform vec4 ray_color : source_color = vec4(1.0, 0.86, 0.5, 1.0);
uniform float strength = 1.0;
uniform vec2 inner = vec2(0.72, 0.42);  // the button's half-size in this rect's UV

void fragment() {
	vec2 q = (UV - 0.5) * 2.0;
	// Distance past the button's rounded edge, in "button sizes".
	vec2 e = abs(q) / (inner * 2.0);
	float edge = length(max(e - vec2(1.0), vec2(0.0))) * 0.5;
	float ang = atan(q.y, q.x * 0.55);
	float spin = TIME * 0.12;
	float rays = pow(abs(sin(ang * 11.0 + spin)), 22.0) + 0.6 * pow(abs(sin(ang * 17.0 - spin * 1.3 + 1.0)), 30.0);
	float breathe = 0.65 + 0.35 * sin(TIME * 1.6);
	float reach = 0.38 + 0.12 * breathe;
	float band = smoothstep(0.0, 0.05, edge) * (1.0 - smoothstep(reach * 0.4, reach, edge));
	float glow = exp(-edge * 9.0) * 0.5;
	float a = (rays * band + glow) * strength * breathe;
	COLOR = vec4(ray_color.rgb, clamp(a, 0.0, 1.0) * ray_color.a);
}
