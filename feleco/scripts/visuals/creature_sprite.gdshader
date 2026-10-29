shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;

// Billboarded creature sprite drawn through a MultiMesh. Each species has an
// animation sheet of painted frames (walk cycles, eating, sleeping, startles,
// a look at the camera...); the rig picks the frame for what the creature is
// doing and adds a little breathing and sway. Style picks the rig.
// INSTANCE_CUSTOM: x facing (+1 right / -1 left), y gait phase (radians),
// z motion 0..1 (or a forced frame + 2), w atlas cell + fract(per-creature seed).

uniform sampler2D sprite : source_color, filter_linear_mipmap, repeat_disable;
uniform float quad_height = 2.0;
uniform float quad_width = 2.0;
uniform int style = 0;
// Animation sheet: columns are frames, rows the six kind/sex cells.
uniform vec2 grid = vec2(25.0, 8.0);
// Gait phase per second, to turn the phase back into the creature's clock.
uniform float gait = 9.0;
uniform vec2 texel = vec2(0.0078125, 0.0078125);
uniform vec4 rim_color : source_color = vec4(1.0, 0.82, 0.3, 1.0);
uniform float rim = 0.0;
// Creatures the player has money on: a bright outline that beats the champion gold.
uniform vec4 bet_color : source_color = vec4(1.0, 0.97, 0.75, 1.0);
// 0 by day, 1 at midnight. Sprites are unshaded, so the moonlight is a tint.
uniform float night = 0.0;

varying float v_glow;
varying float v_shimmer;
varying float v_shade;
varying float v_role;
varying float v_bet;

#include "res://scripts/visuals/creature_rig.gdshaderinc"

void vertex() {
	vec4 c = INSTANCE_CUSTOM;
	// Failsafe: bad instance data (NaN, infinity, a cell off the sheet) would
	// draw as a giant rainbow smear. Such an instance collapses to a point.
	bool bad = any(isnan(c)) || any(isinf(c)) || any(isnan(COLOR)) || any(isinf(COLOR)) || c.w < 0.0 || c.w >= 32.0 || abs(c.y) > 1000.0 || abs(c.z) > 100.0;
	if (bad) {
		c = vec4(1.0, 0.0, 0.0, 0.0);
	}
	float cell = floor(c.w);
	// +16: the camera is following this one. +8: it carries a bet
	// (see VisualProxyManager.marked).
	bool watched = cell >= 16.0;
	cell -= watched ? 16.0 : 0.0;
	v_bet = cell >= 8.0 ? 1.0 : 0.0;
	cell -= v_bet * 8.0;
	float seed = fract(c.w) * 20.0;
	float role = mod(cell, 4.0);
	v_role = role;
	float g = 0.0;
	float sh = 0.0;
	// The instance colour's alpha carries the action (see VisualProxyManager).
	int action = int(round(COLOR.a * 15.0));
	vec2 v = creature_rig(VERTEX.xy, UV, quad_width, quad_height, style, cell, seed, c.x, c.y, c.z, action, g, sh);
	int frame = creature_frame(style, action, c.y, c.z, c.y / max(gait, 0.01), seed, watched);
	v_glow = g;
	v_shimmer = sh;
	float face = c.x < 0.0 ? -1.0 : 1.0;
	float up = 1.0 - UV.y;
	// A soft contact shade: the lowest part of every body sits a touch darker.
	v_shade = mix(0.86, 1.0, smoothstep(0.0, 0.3, up));

	vec2 uv = UV;
	if (face < 0.0) {
		uv.x = 1.0 - uv.x;
	}
	UV = (vec2(float(frame), cell) + clamp(uv, vec2(0.004), vec2(0.996))) / grid;
	VERTEX.xy = (bad || any(isnan(v)) || any(isinf(v)) || length(v) > quad_height * 4.0 + 8.0) ? vec2(0.0) : v;
	float sx = length(MODEL_MATRIX[0].xyz);
	float sy = length(MODEL_MATRIX[1].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * sx, INV_VIEW_MATRIX[1] * sy, INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_NORMAL_MATRIX = mat3(MODELVIEW_MATRIX);
}

void fragment() {
	vec4 t = texture(sprite, UV);
	vec3 col = t.rgb * COLOR.rgb * v_shade;
	float a = t.a;
	col *= 1.0 + v_shimmer * 0.12;
	if (v_glow > 0.0 && t.g > 0.75 && t.r < 0.7 && t.b < 0.8) {
		col *= 1.0 + v_glow * 0.6;
	}
	if ((rim > 0.0 || v_bet > 0.5) && a < 0.5) {
		vec2 o = texel * (v_bet > 0.5 ? 4.5 : 3.0);
		float n = texture(sprite, UV + vec2(o.x, 0.0)).a + texture(sprite, UV - vec2(o.x, 0.0)).a
			+ texture(sprite, UV + vec2(0.0, o.y)).a + texture(sprite, UV - vec2(0.0, o.y)).a;
		if (n > 0.5) {
			col = v_bet > 0.5 ? bet_color.rgb * (1.15 + 0.25 * sin(TIME * 5.0)) : rim_color.rgb;
			a = 1.0;
		}
	}
	// Moonlight: cool and dim, except for things that glow (wizard orbs,
	// glowworms, golden koi, mushroom caps), which stay bright after dark.
	float glows = max(v_glow, v_shimmer) + (style == 12 ? 0.6 : 0.0) + (style == 10 && v_role > 1.5 ? 0.8 : 0.0);
	// Exposure does the darkening; this only cools the colours, and glowing
	// things are pushed brighter so they stand out after dark.
	vec3 moon = col * vec3(0.78, 0.84, 1.08);
	col = mix(col, moon, night * (1.0 - clamp(glows, 0.0, 0.85)));
	col *= 1.0 + night * clamp(glows, 0.0, 1.0) * 0.9;
	ALBEDO = col;
	ALPHA = a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
}
