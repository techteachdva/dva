shader_type canvas_item;
render_mode blend_add;

// One instance per poster grain. INSTANCE_CUSTOM = (birth 0..1, seed, origin.x, origin.y) in pixels.
uniform float t = 0.0;
uniform float span = 1.4;
uniform float life = 1.3;
uniform float grain = 10.0;
uniform vec2 centre = vec2(960.0, 540.0);

varying float v_alpha;
varying vec3 v_col;

void vertex() {
	float birth = INSTANCE_CUSTOM.r * span;
	float seed = INSTANCE_CUSTOM.g;
	vec2 origin = INSTANCE_CUSTOM.ba;
	float age = t - birth;
	if (age < 0.0 || age > life) {
		VERTEX = vec2(-99999.0);
		v_alpha = 0.0;
	} else {
		float k = age / life;
		vec2 away = origin - centre;
		vec2 dir = normalize(away + vec2(seed - 0.5, fract(seed * 7.13) - 0.5) * 120.0);
		float speed = 420.0 + seed * 700.0 + length(away) * 0.6;
		vec2 wind = vec2(340.0, -120.0);
		vec2 swirl = vec2(-dir.y, dir.x) * sin(age * (3.0 + seed * 5.0) + seed * 40.0) * 46.0 * k;
		vec2 pos = origin + (dir * speed + wind) * age + vec2(0.0, -120.0) * age * age + swirl;
		float s = grain * mix(1.15, 0.25, k) * (0.6 + fract(seed * 3.7) * 0.8);
		float rot = age * (2.0 + seed * 6.0);
		vec2 v = VERTEX * s;
		VERTEX = pos + vec2(v.x * cos(rot) - v.y * sin(rot), v.x * sin(rot) + v.y * cos(rot));
		// Dark backdrop grains mostly vanish; a few become warm sparks. Bright ones glow.
		float lum = dot(COLOR.rgb, vec3(0.3, 0.59, 0.11));
		float spark = step(0.9, fract(seed * 13.7));
		float vis = max(smoothstep(0.12, 0.32, lum), spark * 0.8);
		v_col = mix(vec3(1.0, 0.86, 0.55), COLOR.rgb * 1.35 + 0.08, smoothstep(0.12, 0.3, lum));
		v_alpha = vis * (1.0 - k * k) * smoothstep(0.0, 0.05, age);
	}
}

void fragment() {
	vec2 p = UV - 0.5;
	float soft = 1.0 - smoothstep(0.2, 0.5, length(p));
	COLOR = vec4(v_col, v_alpha * soft);
}
