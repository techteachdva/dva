shader_type spatial;
render_mode unshaded, cull_disabled;

// A fruit lit from inside: white-hot at the heart, neon blooming out to the
// tips of its ribs, stars in the skin.

#include "res://scripts/visuals/radiant.gdshaderinc"

varying vec3 local;

void vertex() {
	local = VERTEX;
}

void fragment() {
	vec3 n = normalize(NORMAL);
	float r = length(local);
	float facing = abs(dot(n, normalize(VIEW)));
	vec3 col = radiant_flow(vec2(r, facing * 0.35) * 2.0, TIME);
	col = mix(col, vec3(1.0, 0.97, 1.0), pow(clamp(1.0 - r * 1.25, 0.0, 1.0), 1.5) * 0.8);
	col += radiant_flow(vec2(r + 0.4, 0.0), TIME) * pow(1.0 - facing, 2.0) * 0.6;
	ALBEDO = col + vec3(radiant_stars(local.xy + local.z, 7.0, TIME));
}
