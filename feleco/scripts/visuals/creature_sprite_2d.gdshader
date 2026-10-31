shader_type canvas_item;

// The Field Guide's living creatures: the same rig as the valley's sprites
// (creature_rig.gdshaderinc), drawn on a fine 2D grid mesh. The mesh is
// built in quad units with +y up (see FieldGuide._creature_mesh); this
// shader animates it and scales it into pixels.

uniform sampler2D sprite : source_color, filter_linear_mipmap, repeat_disable;
uniform vec2 quad = vec2(2.0, 2.0);
uniform int style = 0;
uniform float atlas_cell = 0.0;
uniform float creature_seed = 0.0;
uniform float face_dir = 1.0;
uniform float motion = 1.0;
uniform float gait = 9.0;
uniform float px = 40.0;
uniform vec2 grid = vec2(25.0, 8.0);
// Hover: a gold outline and a little lift.
uniform float hover = 0.0;
uniform int pose_action = 0;
uniform vec2 texel = vec2(0.0078125, 0.0078125);

varying float v_glow;
varying float v_shimmer;
varying vec2 v_body;

uniform float brand_slot = 0.0;
// The brand studio's paint view: one still frame, exactly on the canvas.
uniform int force_frame = -1;
uniform float flat_body = 0.0;

#include "res://scripts/visuals/creature_rig.gdshaderinc"
#include "res://scripts/visuals/brand.gdshaderinc"

void vertex() {
	float g = 0.0;
	float sh = 0.0;
	float p = TIME * gait + creature_seed;
	v_body = vec2(face_dir < 0.0 ? 1.0 - UV.x : UV.x, 1.0 - UV.y);
	vec2 v = creature_rig(VERTEX * quad, UV, quad.x, quad.y, style, atlas_cell, creature_seed, face_dir, p, motion, pose_action, g, sh);
	if (flat_body < 0.5) {
		v = brand_warp(v, v_body, face_dir < 0.0 ? -1.0 : 1.0, quad.x, quad.y, brand_slot, TIME);
	}
	v_glow = g;
	v_shimmer = sh;
	v.y += hover * quad.y * 0.04;
	VERTEX = vec2(v.x, -v.y) * px;
	// Hovered, it looks up at you.
	int frame = hover > 0.5 && style != 12 ? F_CAMERA : creature_frame(style, pose_action, p, motion, p / max(gait, 0.01), creature_seed, false);
	if (force_frame >= 0) {
		frame = force_frame;
	}
	vec2 uv = UV;
	if (face_dir < 0.0) {
		uv.x = 1.0 - uv.x;
	}
	UV = (vec2(float(frame), atlas_cell) + clamp(uv, vec2(0.004), vec2(0.996))) / grid;
}

void fragment() {
	vec4 t = texture(sprite, UV);
	vec3 col = t.rgb * (1.0 + v_shimmer * 0.12);
	vec4 branded = brand_overlay(col, t.a, v_body, brand_slot, TIME);
	col = branded.rgb;
	t.a = branded.a;
	if (v_glow > 0.0 && t.g > 0.75 && t.r < 0.7 && t.b < 0.8) {
		col *= 1.0 + v_glow * 0.6;
	}
	bool outline = false;
	if (hover > 0.0 && t.a < 0.5) {
		vec2 o = texel * 3.0;
		float n = texture(sprite, UV + vec2(o.x, 0.0)).a + texture(sprite, UV - vec2(o.x, 0.0)).a
			+ texture(sprite, UV + vec2(0.0, o.y)).a + texture(sprite, UV - vec2(0.0, o.y)).a;
		if (n > 0.5) {
			col = vec3(0.902, 0.765, 0.416);
			outline = true;
		}
	}
	float cut = brand_slot > 0.5 ? 0.12 : 0.5;
	if (!outline && t.a < cut) {
		discard;
	}
	COLOR = vec4(col, 1.0);
}
