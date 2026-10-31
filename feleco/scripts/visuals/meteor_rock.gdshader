shader_type spatial;
render_mode unshaded, cull_disabled;

// Charred rock split by lava seams. heat brightens the seams; inner shows the
// holographic foil on the inside of the opened shell.

uniform float heat = 1.0;
uniform float inner = 0.0;

varying vec3 local;

float hash(vec3 p) {
	return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

#include "res://scripts/visuals/radiant.gdshaderinc"

void vertex() {
	local = VERTEX;
	// A rough lump, not a ball.
	if (inner < 0.5) {
		VERTEX += NORMAL * (noise(VERTEX * 1.7) - 0.5) * 0.42;
	}
}

void fragment() {
	vec3 n = normalize(NORMAL);
	if (inner > 0.5) {
		vec2 q = local.xz / 2.1;
		vec3 glow = radiant_flow(q * 1.6, TIME);
		glow = mix(glow, vec3(1.0, 0.96, 1.0), pow(clamp(1.0 - length(q) * 2.0, 0.0, 1.0), 2.0) * 0.85);
		ALBEDO = glow + vec3(radiant_stars(q, 6.0, TIME));
	} else {
		float grain = noise(local * 3.1);
		vec3 rock = mix(vec3(0.1, 0.08, 0.08), vec3(0.3, 0.25, 0.23), grain);
		float seams = 1.0 - abs(noise(local * 1.5 + 4.0) - 0.5) * 2.0;
		float lava = smoothstep(0.86, 0.97, seams) * heat;
		rock *= 0.65 + 0.35 * clamp(n.y + 0.5, 0.0, 1.0);
		ALBEDO = mix(rock, vec3(1.0, 0.56, 0.12) + vec3(0.0, 0.3, 0.1) * lava, clamp(lava, 0.0, 1.0));
	}
}
