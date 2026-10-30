// Magic brand for a claimed creature. Slot 0 is unmarked.
// The brand atlas is 16 x 32: two pixels per body part, one row per creature.
// Pixel A: colour, and size in alpha. Pixel B: shape, texture, density, school
// (1 = light, 0 = dark). Parts: legs, tail, belly, back, neck, head, crown.

uniform sampler2D brand_tex : filter_nearest, repeat_disable;

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

vec2 brand_warp(vec2 v, vec2 uv, float qw, float qh, float slot, float t) {
	if (slot < 0.5) return v;
	float face = 1.0;
	float tx = uv.x;
	float up = 1.0 - uv.y;
	int part = brand_part(vec2(tx, up));
	vec3 col;
	float size;
	float shape;
	float pat;
	float school;
	brand_read(slot, part, col, size, shape, pat, school);
	vec2 anchor = vec2((tx - 0.5) * qw, (up - 0.45) * qh);
	vec2 d = v - anchor;
	d *= size;
	float n = sin(tx * 18.0 + up * 9.0 + t * 2.0);
	if (shape > 0.5 && shape < 1.5) {
		d += normalize(d + vec2(0.001, 0.2)) * abs(n) * qh * 0.08 * (school < 0.5 ? 1.4 : 0.7);
	} else if (shape > 1.5 && shape < 2.5) {
		d *= vec2(1.15, 1.25);
	} else if (shape > 2.5 && shape < 3.5 && up > 0.4) {
		d.x += (tx - 0.5) * qw * 0.55;
		d.y += qh * 0.12;
	} else if (shape > 3.5 && shape < 4.5) {
		d.x += sin(up * 16.0 - t * 3.0) * qw * 0.06;
		d.y += cos(tx * 10.0 + t) * qh * 0.04;
	} else if (shape > 4.5 && shape < 5.5) {
		d.x *= 1.35;
		d.y *= 0.72;
	} else if (shape > 5.5 && (part == 6 || part == 5)) {
		d.y += qh * 0.06 * size;
		d.x += (tx - 0.72) * qw * 0.08;
	}
	return anchor + d;
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
	vec3 col = mix(base, base * tint * 1.35, 0.72);
	vec2 p = body * vec2(9.0, 7.0);
	float mark = 0.0;
	if (pat > 0.5 && pat < 1.5) {
		vec2 cell = fract(p) - 0.5;
		mark = smoothstep(0.42, 0.2, length(cell));
	} else if (pat < 2.5) {
		mark = smoothstep(0.08, 0.0, abs(fract(p.x * 1.7 + p.y) - 0.5));
	} else if (pat < 3.5) {
		mark = smoothstep(0.97, 1.0, _hash(floor(p * 3.0)));
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
		col = mix(col, vec3(1.0, 0.15, 0.1), mark);
	} else if (school > 0.5) {
		col = mix(col, vec3(1.0, 0.95, 0.75), mark * 0.65);
	} else {
		col = mix(col, tint * 0.35, mark * 0.8);
	}
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
	if (school < 0.5 && up < 0.4 && a < 0.3) {
		float drip = smoothstep(0.03, 0.0, abs(fract(tx * 9.0) - 0.5));
		drip *= smoothstep(0.38, 0.05, up) * (0.4 + 0.6 * fract(t * 0.3 + tx));
		if (drip > 0.2) {
			col = vec3(0.05, 0.0, 0.02);
			a = max(a, drip * 0.8);
		}
	}
	return vec4(col, a);
}
