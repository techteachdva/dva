// The Rainbow look, shared by Starfruit, the crater's heart and Rainbow
// creatures: neon colour blooming outward from a bright centre, with stars
// twinkling in it. One slow loop of colour across the whole radius, so it reads
// as a glow and never as stripes.

// Hot pink, violet, electric blue, cyan, mint, sunset gold, round again.
vec3 radiant_neon(float h) {
	float t = fract(h) * 6.0;
	float i = floor(t);
	float f = t - i;
	f = f * f * (3.0 - 2.0 * f);
	vec3 a;
	vec3 b;
	if (i < 1.0) { a = vec3(1.0, 0.1, 0.62); b = vec3(0.56, 0.16, 1.0); }
	else if (i < 2.0) { a = vec3(0.56, 0.16, 1.0); b = vec3(0.1, 0.46, 1.0); }
	else if (i < 3.0) { a = vec3(0.1, 0.46, 1.0); b = vec3(0.1, 1.0, 0.95); }
	else if (i < 4.0) { a = vec3(0.1, 1.0, 0.95); b = vec3(0.45, 1.0, 0.55); }
	else if (i < 5.0) { a = vec3(0.45, 1.0, 0.55); b = vec3(1.0, 0.72, 0.25); }
	else { a = vec3(1.0, 0.72, 0.25); b = vec3(1.0, 0.1, 0.62); }
	return mix(a, b, f);
}

// Flows outward from r = 0; the wobble keeps the edges from looking ruled.
vec3 radiant_flow(vec2 p, float time) {
	float r = length(p);
	float a = atan(p.y, p.x);
	float wobble = sin(a * 3.0 + time * 0.6) * 0.05 + sin(a * 5.0 - time * 0.4) * 0.03;
	return radiant_neon(r * 0.62 - time * 0.16 + wobble);
}

// Four-pointed stars, each on its own twinkle. size: cells across a unit.
float radiant_stars(vec2 p, float size, float time) {
	vec2 q = p * size;
	vec2 id = floor(q);
	vec2 f = fract(q) - 0.5;
	float n = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
	if (n < 0.62) {
		return 0.0;
	}
	vec2 at = f - (vec2(fract(n * 7.3), fract(n * 13.7)) - 0.5) * 0.5;
	float twinkle = pow(0.5 + 0.5 * sin(time * (2.0 + n * 3.0) + n * 40.0), 6.0);
	float cross_arm = 0.012 / (abs(at.x * at.y) * 14.0 + 0.012);
	return min(cross_arm * smoothstep(0.4, 0.0, length(at)), 1.0) * twinkle;
}
