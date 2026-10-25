// The creature rig shared by the valley (3D, creature_sprite.gdshader) and
// the Field Guide (2D, creature_sprite_2d.gdshader). Coordinates are in quad
// units with +y up; tx runs tail 0 -> head 1, up runs feet 0 -> top 1.

// 0..1 weight for a box in sprite space (tx: tail 0 -> head 1, up: feet 0 -> top 1).
float region(float tx, float up, vec4 box) {
	return smoothstep(box.x - 0.06, box.x, tx) * (1.0 - smoothstep(box.y, box.y + 0.06, tx))
		* smoothstep(box.z - 0.06, box.z, up) * (1.0 - smoothstep(box.w, box.w + 0.06, up));
}

vec2 rock(vec2 v, float a, float base_y) {
	v.y -= base_y;
	v = vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a));
	v.y += base_y;
	return v;
}

// Turn the weighted part of the drawing about a joint. The joint is given in
// sprite space (tx, up); a positive angle swings the part forward (toward the
// head) whichever way the creature faces.
vec2 joint(vec2 v, float w, vec2 at, float angle, float face, float qw, float qh) {
	if (w <= 0.0) {
		return v;
	}
	vec2 pivot = vec2((at.x - 0.5) * qw * face, (at.y - 0.5) * qh);
	float a = -angle * face * w;
	vec2 d = v - pivot;
	return pivot + vec2(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a));
}

// A quadruped's legs: back pair and front pair swing in opposition from the
// hips and shoulders. Weight fades in below the hip so the body stays put.
vec2 legs(vec2 v, float tx, float up, vec4 back_x, vec4 front_x, float hip, float swing, float face, float qw, float qh) {
	float under = 1.0 - smoothstep(hip - 0.06, hip + 0.02, up);
	float back = smoothstep(back_x.x - 0.04, back_x.x, tx) * (1.0 - smoothstep(back_x.y, back_x.y + 0.04, tx)) * under;
	float front = smoothstep(front_x.x - 0.04, front_x.x, tx) * (1.0 - smoothstep(front_x.y, front_x.y + 0.04, tx)) * under;
	v = joint(v, back, vec2((back_x.x + back_x.y) * 0.5, hip), swing, face, qw, qh);
	v = joint(v, front, vec2((front_x.x + front_x.y) * 0.5, hip), -swing, face, qw, qh);
	return v;
}


// Actions (VisualProxyManager.ACTIONS maps every state to one).
const int ACTION_MOVE = 0;
const int ACTION_EAT = 1;
const int ACTION_FIGHT = 2;
const int ACTION_FLEE = 3;
const int ACTION_SLEEP = 4;
const int ACTION_COURT = 5;
const int ACTION_WORK = 6;

// The head, by body plan: [region box, neck joint].
vec4 head_box(int st) {
	if (st == 8 || st == 9) return vec4(0.62, 1.0, 0.5, 1.0);   // birds
	if (st >= 5 && st <= 7) return vec4(0.25, 0.75, 0.7, 1.0);  // villagers
	if (st == 10) return vec4(0.8, 1.0, 0.0, 1.0);              // worm
	return vec4(0.66, 1.0, 0.34, 1.0);                          // four legs
}
vec2 neck_joint(int st) {
	if (st == 8 || st == 9) return vec2(0.64, 0.6);
	if (st >= 5 && st <= 7) return vec2(0.5, 0.7);
	if (st == 10) return vec2(0.82, 0.2);
	return vec2(0.68, 0.58);
}

// What the creature is doing, layered over its walk: eating dips the head
// and chews (birds peck), fighting lunges and jabs, fleeing leans and
// stretches, sleeping settles low and breathes slowly, courting bounces,
// working bobs.
vec2 action_pose(vec2 v, float tx, float up, int st, int action, float p, float seed, float face, float w, float h, float base) {
	if (action == ACTION_MOVE || st == 11 || st == 12) {
		return v;
	}
	float head = region(tx, up, head_box(st));
	vec2 neck = neck_joint(st);
	bool bird = st == 8 || st == 9;
	bool folk = st >= 5 && st <= 7;
	if (action == ACTION_EAT) {
		if (bird) {
			float peck = pow(max(sin(p * 2.2 + seed), 0.0), 3.0);
			v = joint(v, head, neck, -0.9 * peck, face, w, h);
		} else if (folk) {
			v = joint(v, head, neck, -0.22 + sin(p * 3.0) * 0.06, face, w, h);
			v.y -= h * 0.02;
		} else {
			float chew = sin(p * 3.0 + seed);
			v = joint(v, head, neck, -0.6 - 0.08 * chew, face, w, h);
		}
	} else if (action == ACTION_FIGHT) {
		float strike = pow(max(sin(p * 1.6 + seed), 0.0), 2.0);
		if (folk) {
			v.x += face * h * 0.07 * strike;
			v = rock(v, -0.1 * strike * face, base);
		} else {
			// Rear back, then lunge with the jaws (or talons) first.
			v = rock(v, (0.12 - 0.3 * strike) * face, base);
			v = joint(v, head, neck, 0.35 * strike - 0.1, face, w, h);
		}
	} else if (action == ACTION_FLEE) {
		v.x *= 1.08;
		v = rock(v, -0.1 * face, base);
		v = joint(v, head, neck, 0.15, face, w, h);
	} else if (action == ACTION_SLEEP) {
		float breath = 1.0 + 0.05 * sin(p * 0.25 + seed);
		v.y = base + (v.y - base) * 0.72 * breath;
		v.y -= h * 0.03;
		v = joint(v, head, neck, folk ? -0.15 : -0.45, face, w, h);
	} else if (action == ACTION_COURT) {
		v.y += abs(sin(p * 1.5 + seed)) * h * 0.07;
		v = rock(v, sin(p * 0.8) * 0.1, base);
		v = joint(v, head, neck, 0.25 * sin(p * 1.5), face, w, h);
	} else if (action == ACTION_WORK) {
		float swing = sin(p * 1.2 + seed);
		v = rock(v, swing * 0.09 * face, base);
		v = joint(v, head, neck, -0.15 + swing * 0.1, face, w, h);
	}
	return v;
}

// Deforms one vertex of a creature drawn on a qw x qh quad.
// style: species rig, cell/seed: atlas cell and per-creature seed,
// facing: +1 right / -1 left, p: gait phase, m: motion 0..1.
// action: what it is doing (see ACTION_* below), layered on the species rig.
// Writes glow and shimmer for the fragment stage.
vec2 creature_rig(vec2 v, vec2 uv, float qw, float qh, int rig_style, float cell, float seed, float facing, float p, float m, int action, out float out_glow, out float out_shimmer) {
	float role = mod(cell, 3.0);
	float face = facing < 0.0 ? -1.0 : 1.0;
	float idle = 1.0 - m;
	float h = qh;
	float w = qw;
	float base = -h * 0.5;
	float tx = face > 0.0 ? uv.x : 1.0 - uv.x;
	float up = 1.0 - uv.y;
	float breathe = sin(p * 0.35 + seed) * 0.02 * idle;
	v.y = base + (v.y - base) * (1.0 + breathe);
	float rig_glow = 0.0;
	float rig_shimmer = 0.0;
	int st = rig_style;
	if (st == 5 && role > 0.5) {
		st = role > 1.5 ? 6 : 7;
	}
	rig_shimmer =(role > 1.5 && st != 6) ? 0.5 + 0.5 * sin(p * 0.6 + seed) : 0.0;

	if (st == 1) {
		// Sheep: a short-legged trot, a woolly bob; idle sheep lower their
		// heads to graze, flick an ear and wag a stubby tail.
		v = legs(v, tx, up, vec4(0.22, 0.42, 0.0, 0.0), vec4(0.52, 0.72, 0.0, 0.0), 0.3, sin(p) * 0.38 * m, face, w, h);
		v.y += abs(sin(p)) * m * h * 0.04;
		float graze = idle * smoothstep(0.2, 0.9, sin(p * 0.22 + seed));
		float head = region(tx, up, vec4(0.7, 1.0, 0.36, 1.0));
		v = joint(v, head, vec2(0.7, 0.58), -graze * 0.75 + sin(p * 2.0) * 0.06 * m, face, w, h);
		float tail = region(tx, up, vec4(0.0, 0.16, 0.45, 0.8));
		v = joint(v, tail, vec2(0.14, 0.62), sin(p * 3.1 + seed) * 0.35, face, w, h);
	} else if (st == 2) {
		// Wolf: long low lope with a reaching stride, head level and
		// forward; the tail swings from its root and wags hard at rest.
		float s = sin(p);
		v = legs(v, tx, up, vec4(0.2, 0.42, 0.0, 0.0), vec4(0.55, 0.78, 0.0, 0.0), 0.36, s * 0.5 * m, face, w, h);
		v.y += abs(cos(p)) * h * 0.035 * m;
		v = rock(v, s * 0.04 * m * face, base);
		float tail = region(tx, up, vec4(0.0, 0.24, 0.32, 0.85));
		v = joint(v, tail, vec2(0.22, 0.6), sin(p * (1.7 + idle * 2.0)) * (0.18 + 0.3 * idle), face, w, h);
		float head = region(tx, up, vec4(0.72, 1.0, 0.45, 1.0));
		float sniff = idle * pow(max(sin(p * 0.3 + seed), 0.0), 3.0);
		v = joint(v, head, vec2(0.72, 0.62), -0.12 * m - sniff * 0.45 + sin(p * 2.0) * 0.05 * m, face, w, h);
	} else if (st == 3) {
		// Boar: quick heavy stomp on stiff little legs; idle boars root
		// with the whole head swinging down from the neck.
		float stomp = pow(abs(sin(p)), 4.0) * m;
		v = legs(v, tx, up, vec4(0.2, 0.4, 0.0, 0.0), vec4(0.55, 0.75, 0.0, 0.0), 0.28, sin(p) * 0.32 * m, face, w, h);
		v.y += stomp * h * 0.05;
		float head = region(tx, up, vec4(0.7, 1.0, 0.1, 0.9));
		float root = idle * max(sin(p * 0.9 + seed), 0.0);
		v = joint(v, head, vec2(0.68, 0.55), -root * 0.5 + sin(p * 2.0) * 0.06 * m, face, w, h);
		float tail = region(tx, up, vec4(0.0, 0.14, 0.45, 0.85));
		v = joint(v, tail, vec2(0.12, 0.66), sin(p * 5.0 + seed) * 0.4, face, w, h);
	} else if (st == 4) {
		// Rabbit: arcing hops with stretch and landing squash; hind legs
		// kick back in the air; ears swivel at their base and twitch.
		float air = max(sin(p * 0.5), 0.0) * m;
		float land = max(-sin(p * 0.5), 0.0) * m;
		v.y = base + (v.y - base) * (1.0 + air * 0.14 - land * 0.1);
		v.x *= 1.0 - air * 0.05 + land * 0.08;
		float hind = region(tx, up, vec4(0.1, 0.5, 0.0, 0.32));
		v = joint(v, hind, vec2(0.36, 0.3), -air * 0.7, face, w, h);
		v.y += air * h * 0.24;
		v = rock(v, -air * 0.16 * face, base);
		float ears = region(tx, up, vec4(0.52, 0.86, 0.6, 1.0));
		float twitch = pow(max(sin(p * 0.4 + seed), 0.0), 12.0);
		v = joint(v, ears, vec2(0.66, 0.62), -air * 0.5 + twitch * sin(p * 9.0) * 0.25 + idle * 0.08 * sin(p * 0.7 + seed), face, w, h);
	} else if (st == 5 || st == 7) {
		// Villagers: a walking sway, feet stepping in turn; idle folk shift
		// their weight and glance about.
		v.y += abs(sin(p)) * h * 0.03 * m;
		v = rock(v, sin(p) * 0.05 * m, base);
		float under = 1.0 - smoothstep(0.2, 0.3, up);
		float lfoot = under * (1.0 - smoothstep(0.46, 0.5, tx));
		float rfoot = under * smoothstep(0.5, 0.54, tx);
		v = joint(v, lfoot, vec2(0.45, 0.28), sin(p) * 0.35 * m, face, w, h);
		v = joint(v, rfoot, vec2(0.55, 0.28), -sin(p) * 0.35 * m, face, w, h);
		float head = region(tx, up, vec4(0.25, 0.75, 0.7, 1.0));
		v = joint(v, head, vec2(0.5, 0.7), idle * sin(p * 0.25 + seed) * 0.12, face, w, h);
		if (st == 7) {
			// Builder: the mallet over the shoulder swings down and back.
			float mallet = region(tx, up, vec4(0.0, 0.48, 0.66, 1.0));
			float tap = pow(max(sin(p * 0.8 + seed), 0.0), 3.0);
			v = joint(v, mallet, vec2(0.42, 0.62), tap * 0.6, face, w, h);
		}
	} else if (st == 6) {
		// Wizard: hovers a hand above the grass, robe hem rippling, staff
		// arm raised in time with the pulsing orb.
		v.y += h * (0.05 + 0.03 * sin(p * 0.5));
		float hem = 1.0 - smoothstep(0.0, 0.35, up);
		v.x += sin(p * 0.8 + up * 6.0) * hem * h * 0.035;
		float staff = region(tx, up, vec4(0.62, 1.0, 0.0, 1.0));
		v = joint(v, staff, vec2(0.62, 0.45), sin(p * 0.45 + seed) * 0.08, face, w, h);
		rig_glow = 0.5 + 0.5 * sin(p * 0.9 + seed);
	} else if (st == 8) {
		// Falcon: banks while soaring, then bursts of deep wingbeats from
		// the shoulder; the tail fans to steer.
		float bursts = smoothstep(0.1, 0.7, sin(p * 0.21 + seed));
		float wings = region(tx, up, vec4(0.0, 0.8, 0.55, 1.0));
		v = joint(v, wings, vec2(0.6, 0.5), sin(p * 2.6) * bursts * 0.55, face, w, h);
		float tail = region(tx, up, vec4(0.0, 0.25, 0.2, 0.55));
		v = joint(v, tail, vec2(0.28, 0.42), sin(p * 0.33) * 0.2, face, w, h);
		v = rock(v, sin(p * 0.33) * 0.14, 0.0);
	} else if (st == 9) {
		// Robin: quick flutter from the shoulder, tail flicks up, head
		// cocks to listen for worms, little jerky hops.
		float wing = region(tx, up, vec4(0.25, 0.62, 0.3, 0.62));
		v = joint(v, wing, vec2(0.55, 0.55), sin(p * 2.4) * 0.5 * (0.3 + 0.7 * m), face, w, h);
		float tail = region(tx, up, vec4(0.0, 0.3, 0.3, 0.7));
		v = joint(v, tail, vec2(0.3, 0.45), pow(max(sin(p * 1.3 + seed), 0.0), 4.0) * -0.6, face, w, h);
		float head = region(tx, up, vec4(0.62, 1.0, 0.55, 1.0));
		v = joint(v, head, vec2(0.66, 0.6), idle * step(0.6, sin(p * 0.6 + seed)) * 0.35, face, w, h);
		v.y += pow(abs(sin(p * 0.5)), 8.0) * h * 0.08;
	} else if (st == 10) {
		// Worm: a peristaltic wave rolls from tail to head; the head
		// lifts and sways as it feels the way.
		float wave = sin(tx * 9.0 - p * 1.6);
		v.y += max(wave, 0.0) * h * 0.1;
		v.x += wave * h * 0.025 * face;
		float head = smoothstep(0.78, 0.95, tx);
		v = joint(v, head, vec2(0.82, 0.2), 0.25 + sin(p * 0.8 + seed) * 0.25, face, w, h);
	} else if (st == 11) {
		// Fish: the tail sweeps from its peduncle and the body follows.
		float tail = 1.0 - tx;
		v.y += sin(p - tail * 4.0) * tail * h * 0.16;
		v.y += sin(p * 0.5) * h * 0.04;
	} else if (st == 12) {
		// Mushrooms: caps sway on their stems; drifting spores tumble.
		float cap = smoothstep(0.35, 0.6, up);
		v = joint(v, cap, vec2(0.5, 0.05), sin(p * 0.9 + seed) * 0.07, face, w, h);
		if (cell < 0.5) {
			v = rock(v, sin(p * 0.7 + seed) * 0.5, 0.0);
		}
	} else {
		float hop = abs(sin(p)) * m;
		v.y += hop * h * 0.08;
	}
	v = action_pose(v, tx, up, st, action, p, seed, face, w, h, base);
	out_glow = rig_glow;
	out_shimmer = rig_shimmer;
	return v;
}
