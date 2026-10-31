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

// How far one part's size and shape move this vertex.
vec2 _brand_move(vec2 v, vec2 body, int part, float face, float qw, float qh, float slot, float t) {
	float tx = body.x;
	float up = body.y;
	vec3 col;
	float size;
	float shape;
	float pat;
	float school;
	brand_read(slot, part, col, size, shape, pat, school);
	vec2 c = _brand_centre(part);
	vec2 anchor = vec2((c.x - 0.5) * qw * face, (c.y - 0.5) * qh);
	vec2 d = v - anchor;
	d *= size;
	float n = sin(tx * 18.0 + up * 9.0 + t * 2.0);
	if (shape > 0.5 && shape < 1.5) {
		d += normalize(d + vec2(0.001, 0.2)) * abs(n) * qh * 0.08 * (school < 0.5 ? 1.4 : 0.7);
	} else if (shape > 1.5 && shape < 2.5) {
		d *= vec2(1.15, 1.25);
	} else if (shape > 2.5 && shape < 3.5 && up > 0.4) {
		d.x += (tx - 0.5) * qw * 0.55 * face;
		d.y += qh * 0.12;
	} else if (shape > 3.5 && shape < 4.5) {
		d.x += sin(up * 16.0 - t * 3.0) * qw * 0.06;
		d.y += cos(tx * 10.0 + t) * qh * 0.04;
	} else if (shape > 4.5 && shape < 5.5) {
		d.x *= 1.35;
		d.y *= 0.72;
	} else if (shape > 5.5 && (part == 6 || part == 5)) {
		d.y += qh * 0.06 * size;
		d.x += (tx - 0.72) * qw * 0.08 * face;
	}
	return anchor + d - v;
}

// body: (tail 0 -> head 1, feet 0 -> top 1) whichever way the sprite faces.
// Moves are averaged across nearby parts so the body stretches, never tears.
vec2 brand_warp(vec2 v, vec2 body, float face, float qw, float qh, float slot, float t) {
	if (slot < 0.5) return v;
	vec2 sum = vec2(0.0);
	for (int i = 0; i < 5; i++) {
		vec2 s = body;
		if (i == 1) s.x += 0.07;
		if (i == 2) s.x -= 0.07;
		if (i == 3) s.y += 0.07;
		if (i == 4) s.y -= 0.07;
		sum += _brand_move(v, body, brand_part(s), face, qw, qh, slot, t);
	}
	return v + sum / 5.0;
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
	// Grown-on parts, in the empty margin of the sprite.
	float tx = body.x;
	float up = body.y;
	if (shape > 5.5 && up > 0.8 && (part == 5 || part == 6)) {
		float horn = 1.0 - smoothstep(0.0, 0.035 + size * 0.02, abs(tx - 0.74));
		horn *= smoothstep(0.8, 0.9, up);
		if (horn > 0.2) {
			// Keep the colour the player picked. Light horns only get a pale edge.
			col = school > 0.5 ? mix(tint, vec3(0.98, 0.94, 0.82), 0.22) : tint * 0.8;
			a = max(a, horn);
		}
	}
	if (shape > 2.5 && shape < 3.5 && up > 0.45 && up < 0.85) {
		float wing = smoothstep(0.15, 0.0, abs(up - 0.66) - 0.12);
		wing *= smoothstep(0.15, 0.55, abs(tx - 0.5));
		if (wing > 0.15 && a < 0.4) {
			vec3 membrane = school > 0.5 ? vec3(0.75, 0.9, 1.0) : vec3(0.25, 0.05, 0.2);
			col = membrane * (0.6 + 0.4 * sin(t * 4.0 + tx * 8.0));
			a = max(a, wing * 0.85);
		}
	}
	if (shape > 0.5 && shape < 1.5 && a < 0.35 && up > 0.35) {
		float spike = smoothstep(0.04, 0.0, abs(fract(tx * 7.0) - 0.5));
		spike *= smoothstep(0.4, 0.85, up);
		if (spike > 0.4) {
			col = school > 0.5 ? vec3(0.9, 0.95, 1.0) : vec3(0.15, 0.02, 0.05);
			a = max(a, spike);
		}
	}
	return vec4(col, a);
}
