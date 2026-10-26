// The creature rig shared by the valley (3D, creature_sprite.gdshader) and
// the Field Guide (2D, creature_sprite_2d.gdshader). Coordinates are in quad
// units with +y up; tx runs tail 0 -> head 1, up runs feet 0 -> top 1.
//
// The animation lives in the painted frames (SpriteGenerator's animation
// sheet: walk cycles, eating, sleeping, startles and so on). The rig picks
// the frame and adds only a little life on top: breathing, a soft sway, a
// wizard's hover, a fish's swim and a mushroom's nod.

// Frames of the animation sheet (SpriteGenerator.F_*).
const int F_STAND = 0;
const int F_WALK = 1;
const int WALK_FRAMES = 12;
const int F_BLINK = 13;
const int F_GLANCE = 14;
const int F_CAMERA = 15;
const int F_EAT = 16;
const int F_ALARM = 18;
const int F_WINDUP = 19;
const int F_STRIKE = 20;
const int F_SLEEP = 21;
const int F_WORK = 23;

// Actions (VisualProxyManager.ACTIONS maps every state to one).
const int ACTION_MOVE = 0;
const int ACTION_EAT = 1;
const int ACTION_FIGHT = 2;
const int ACTION_FLEE = 3;
const int ACTION_SLEEP = 4;
const int ACTION_COURT = 5;
const int ACTION_WORK = 6;
const int ACTION_SURPRISE = 7;

vec2 rock(vec2 v, float a, float base_y) {
	v.y -= base_y;
	v = vec2(v.x * cos(a) - v.y * sin(a), v.x * sin(a) + v.y * cos(a));
	v.y += base_y;
	return v;
}

// Cycles per stride of the gait phase: hoppers and crawlers take their time.
float cycle_rate(int st) {
	if (st == 4 || st == 9) return 0.5;
	if (st == 10) return 0.4;
	if (st == 8) return 0.8;
	return 1.0;
}

// Which painted frame to show. p: gait phase, m: motion 0..1 (1.5 and up
// forces frame round(m) - 2, for staged shots), t: the creature's own clock
// in seconds, watched: the camera is following it (or the pointer is on it).
int creature_frame(int st, int action, float p, float m, float t, float seed, bool watched) {
	if (m >= 1.5) {
		return int(round(m)) - 2;
	}
	if (st == 12) {
		return F_STAND;
	}
	bool moving = m > 0.15;
	int walk = F_WALK + int(floor(fract(p * cycle_rate(st) / 6.2831853) * float(WALK_FRAMES))) % WALK_FRAMES;
	if (st == 8 && moving) {
		// Falcons soar on spread wings between bursts of wingbeats.
		walk = sin(t * 0.35 + seed) > 0.2 ? walk : F_STAND;
	}
	if (action == ACTION_SURPRISE) return F_ALARM;
	if (action == ACTION_SLEEP) return F_SLEEP + (sin(t * 1.2 + seed) > 0.0 ? 1 : 0);
	if (action == ACTION_FLEE) return moving ? walk : F_ALARM;
	if (action == ACTION_FIGHT) {
		if (moving) return walk;
		float c = fract(t * 0.8 + seed * 0.13);
		return c < 0.45 ? F_WINDUP : (c < 0.7 ? F_STRIKE : F_STAND);
	}
	if (action == ACTION_EAT) {
		if (moving) return walk;
		// Heads come up between mouthfuls to look about.
		float c = fract(t * 0.13 + seed * 0.21);
		if (c > 0.86) return (watched && c > 0.92) ? F_CAMERA : F_GLANCE;
		return F_EAT + (fract(t * 1.3 + seed) < 0.5 ? 0 : 1);
	}
	if (action == ACTION_COURT || action == ACTION_WORK) {
		if (moving) return walk;
		return F_WORK + (fract(t * (action == ACTION_WORK ? 1.1 : 0.7) + seed) < 0.5 ? 0 : 1);
	}
	if (moving) return walk;
	// Standing about: a blink now and then, a glance around, and once in a
	// long while a look up at whoever is watching (often, when followed).
	float c = fract(t / 11.0 + seed * 0.37);
	bool look = watched ? (c > 0.15 && c < 0.48) : (fract(t / 43.0 + seed * 0.71) < 0.05);
	if (look) return F_CAMERA;
	if (c > 0.62 && c < 0.7) return F_GLANCE;
	if (fract(t / 3.3 + seed * 0.53) < 0.045) return F_BLINK;
	return F_STAND;
}

// Deforms one vertex of a creature drawn on a qw x qh quad.
// style: species rig, cell/seed: atlas cell and per-creature seed,
// facing: +1 right / -1 left, p: gait phase, m: motion 0..1.
// Writes glow and shimmer for the fragment stage.
vec2 creature_rig(vec2 v, vec2 uv, float qw, float qh, int rig_style, float cell, float seed, float facing, float p, float m, int action, out float out_glow, out float out_shimmer) {
	float role = mod(cell, 4.0);
	float face = facing < 0.0 ? -1.0 : 1.0;
	float idle = 1.0 - clamp(m, 0.0, 1.0);
	float h = qh;
	float w = qw;
	float base = -h * 0.5;
	float tx = face > 0.0 ? uv.x : 1.0 - uv.x;
	float up = 1.0 - uv.y;
	// Breathing, and the faintest bend through the body, so nothing is
	// quite a cardboard cut-out.
	float breathe = sin(p * 0.35 + seed) * 0.012 * idle;
	v.y = base + (v.y - base) * (1.0 + breathe);
	v.x += sin(p * 0.45 + seed) * up * up * w * 0.012;
	float rig_glow = 0.0;
	int st = rig_style;
	if (st == 5 && role > 0.5) {
		st = role > 1.5 ? 6 : 7;
	}
	float rig_shimmer = (role > 1.5 && st != 6) ? 0.5 + 0.5 * sin(p * 0.6 + seed) : 0.0;
	if (st == 6) {
		// Wizard: hovers a hand above the grass, robe hem rippling softly.
		v.y += h * (0.04 + 0.02 * sin(p * 0.5));
		float hem = 1.0 - smoothstep(0.0, 0.35, up);
		v.x += sin(p * 0.8 + up * 6.0) * hem * h * 0.012;
		rig_glow = 0.5 + 0.5 * sin(p * 0.9 + seed);
	} else if (st == 8) {
		// Falcon: banks gently as it soars.
		v = rock(v, sin(p * 0.33 / 5.0 + seed) * 0.05, 0.0);
	} else if (st == 10) {
		// Worm: a little extra ripple along the crawl.
		v.y += max(sin(tx * 9.0 - p * 1.6), 0.0) * h * 0.02 * (1.0 - idle);
	} else if (st == 11) {
		// Fish: the body follows the tail a touch, and rides the current.
		float tail = 1.0 - tx;
		v.y += sin(p - tail * 4.0) * tail * h * 0.04;
		v.y += sin(p * 0.5) * h * 0.02;
	} else if (st == 12) {
		// Mushrooms: caps nod on their stems; drifting spores tumble.
		float cap = smoothstep(0.35, 0.6, up);
		v.x += sin(p * 0.9 + seed) * cap * (up - 0.05) * h * 0.06;
		if (cell < 0.5) {
			v = rock(v, sin(p * 0.7 + seed) * 0.4, 0.0);
		}
	}
	if (action == ACTION_SURPRISE) {
		// A jolt: stretched tall for the startle.
		v.y = base + (v.y - base) * 1.05;
	}
	out_glow = rig_glow;
	out_shimmer = rig_shimmer;
	return v;
}
