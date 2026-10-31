// Magic brand for a claimed creature. Slot 0 is unmarked.
// The brand atlas is 16 x 32: two pixels per body part, one row per creature.
// Pixel A: colour, and size in alpha. Pixel B: shape, texture, density, school
// (1 = light, 0 = dark). Parts: legs, tail, belly, back, neck, head, crown.

uniform sampler2D brand_tex : filter_nearest, repeat_disable;
// The player's drawing: one tile per slot, 8 across and 4 down, in body space.
uniform sampler2D paint_tex : hint_default_transparent, filter_linear, repeat_disable;

int brand_part(vec2 body) {
	float tx = body.x;
	float up = body.y;
	if (up > 0.76 && tx > 0.58) return 6;
	if (tx > 0.76 && up > 0.32) return 5;
	if (tx > 0.60 && up > 0.38) return 4;
	if (up < 0.30) return 0;
	if (tx < 0.30) return 1;
	if (up > 0.52) return 3;
	return 2;
}

void brand_read(float slot, int part, out vec3 col, out float size, out float shape, out float pat, out float school) {
	float v = (slot + 0.5) / 32.0;
	vec4 a = texture(brand_tex, vec2((float(part) * 2.0 + 0.5) / 16.0, v));
	vec4 b = texture(brand_tex, vec2((float(part) * 2.0 + 1.5) / 16.0, v));
	col = a.rgb;
	// Small stays under the natural body. Vast grows, but not enough to
	// swallow the portrait. The old curve made a fresh brand already 1.3x.
	size = mix(0.55, 1.45, a.a);
	shape = floor(b.r * 6.99);
	pat = floor(b.g * 7.99);
	school = b.a;
}

// Where each part grows from, in body space (tx, up).
vec2 _brand_centre(int part) {
	if (part == 0) return vec2(0.5, 0.12);
	if (part == 1) return vec2(0.12, 0.55);
	if (part == 2) return vec2(0.45, 0.38);
	if (part == 3) return vec2(0.45, 0.65);
	if (part == 4) return vec2(0.68, 0.5);
	if (part == 5) return vec2(0.88, 0.55);
	return vec2(0.8, 0.88);
}

// Painted pixels stay put. A fang, a tusk, or a tail in the sprite is not
// pulled by the mesh. The chosen shape is drawn on afterwards, per part.
vec2 brand_warp(vec2 v, vec2 body, float face, float qw, float qh, float slot, float t) {
	// Shapes are drawn in brand_overlay. Stretching the mesh smeared fangs
	// and never reached a tail that sits in the margin.
	return v + vec2(0.0) * (body.x + face + qw + qh + slot + t);
}

// Outward from the part, in body space: tail back, head forward, crown up.
vec2 _brand_out(int part) {
	if (part == 0) return vec2(0.0, -1.0);
	if (part == 1) return vec2(-1.0, 0.2);
	if (part == 2) return vec2(0.15, -1.0);
	if (part == 3) return vec2(-0.15, 1.0);
	if (part == 4) return vec2(0.45, 0.9);
	if (part == 5) return vec2(1.0, -0.05);
	return vec2(0.0, 1.0);
}

// 1 inside the attachment, 0 outside. Grows from the part into the empty margin.
float _brand_attach(int part, float shape, float size, vec2 body, float t) {
	if (shape < 0.5) return 0.0;
	vec2 o = normalize(_brand_out(part));
	vec2 side = vec2(-o.y, o.x);
	vec2 rel = body - _brand_centre(part);
	float along = dot(rel, o);
	float across = dot(rel, side);
	float reach = 0.07 + size * 0.16;
	float w = 0.012 + size * 0.012;
	if (along < -0.01 || along > reach) return 0.0;
	float u = along / reach;
	if (shape < 1.5) {
		float band = abs(fract(across * 10.0 + 0.5) - 0.5);
		return (1.0 - smoothstep(0.0, w * 0.55, band)) * (1.0 - smoothstep(0.15, 1.0, u));
	}
	if (shape < 2.5) {
		vec2 b = vec2(along - reach * 0.55, across);
		return 1.0 - smoothstep(reach * 0.22, reach * 0.38, length(b));
	}
	if (shape < 3.5) {
		float half = mix(0.015, 0.07 + size * 0.05, u);
		return 1.0 - smoothstep(half * 0.8, half, abs(across));
	}
	if (shape < 4.5) {
		float wave = across - sin(along * 36.0 + t * 3.0) * 0.025;
		return 1.0 - smoothstep(0.0, w * 0.85, abs(wave));
	}
	if (shape < 5.5) {
		if (u > 0.62) return 0.0;
		float half = 0.035 + size * 0.04;
		return 1.0 - smoothstep(half * 0.85, half, abs(across));
	}
	float half = w * 1.6 * (1.0 - u);
	return 1.0 - smoothstep(half * 0.7, max(half, 0.004), abs(across));
}

float _hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec4 brand_overlay(vec3 base, float sprite_a, vec2 body, float slot, float t) {
	if (slot < 0.5) return vec4(base, sprite_a);
	int part = brand_part(body);
	vec3 tint;
	float size;
	float shape;
	float pat;
	float school;
	brand_read(slot, part, tint, size, shape, pat, school);
	// Parts melt into each other, and dark hide takes the colour as well as
	// pale wool. The ink outline stays ink.
	vec3 soft = tint;
	float row = (slot + 0.5) / 32.0;
	for (int i = 0; i < 8; i++) {
		float ang = float(i) * 0.7854;
		vec2 at = body + vec2(cos(ang), sin(ang)) * 0.06;
		soft += texture(brand_tex, vec2((float(brand_part(at)) * 2.0 + 0.5) / 16.0, row)).rgb;
	}
	soft /= 9.0;
	float lum = dot(base, vec3(0.3, 0.59, 0.11));
	vec3 col = mix(base, soft * (0.45 + 0.85 * lum), 0.72 * smoothstep(0.08, 0.16, lum));
	vec2 p = body * vec2(9.0, 7.0);
	float mark = 0.0;
	if (pat < 0.5) {
		mark = 0.0;
	} else if (pat < 1.5) {
		vec2 cell = fract(p) - 0.5;
		mark = smoothstep(0.42, 0.2, length(cell));
	} else if (pat < 2.5) {
		mark = smoothstep(0.08, 0.0, abs(fract(p.x * 1.7 + p.y) - 0.5));
	} else if (pat < 3.5) {
		// Four-point sparkles scattered through the cells.
		vec2 c = fract(p * 3.0) - 0.5;
		mark = step(0.68, _hash(floor(p * 3.0))) * smoothstep(0.012, 0.0, abs(c.x * c.y)) * smoothstep(0.42, 0.08, length(c));
	} else if (pat < 4.5) {
		mark = smoothstep(0.45, 0.0, abs(fract(p.y * 2.0 + sin(p.x)) - 0.5));
	} else if (pat < 5.5) {
		vec2 e = fract(p * 0.7) - 0.5;
		mark = smoothstep(0.22, 0.05, length(e)) * (school < 0.5 ? 1.0 : 0.35);
	} else if (pat < 6.5) {
		mark = 0.5 + 0.5 * sin(body.y * 30.0 - t * 6.0);
	} else if (pat > 6.5) {
		mark = smoothstep(0.5, 0.2, abs(fract(body.x * 8.0) - 0.5));
	}
	if (pat > 4.5 && pat < 5.5) {
		col = mix(col, tint, mark);
	} else if (school > 0.5) {
		col = mix(col, vec3(1.0, 0.95, 0.75), mark * 0.65);
	} else {
		col = mix(col, tint * 0.35, mark * 0.8);
	}
	// Over everything: what the player drew. Ink lines stay ink, and the
	// sprite's own light still falls across the paint.
	vec2 cell_uv = clamp(vec2(body.x, 1.0 - body.y), vec2(0.012), vec2(0.988));
	vec2 tile = vec2(mod(slot, 8.0), floor(slot / 8.0));
	vec4 drawn = texture(paint_tex, (tile + cell_uv) / vec2(8.0, 4.0));
	col = mix(col, drawn.rgb * (0.55 + 0.6 * lum), drawn.a * smoothstep(0.08, 0.16, lum));
	float a = sprite_a;
	// One attachment per part, in the empty margin, in that part's own colour.
	// Head grows a fang forward. Crown grows a horn up. Tail grows backward.
	float grown = _brand_attach(part, shape, size, body, t);
	if (grown > 0.2 && sprite_a < 0.4) {
		col = school > 0.5 ? mix(tint, vec3(0.98, 0.94, 0.82), 0.22) : tint * 0.85;
		a = max(a, grown);
	}
	return vec4(col, a);
}
