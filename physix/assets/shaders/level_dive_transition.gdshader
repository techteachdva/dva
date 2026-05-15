shader_type canvas_item;

uniform float progress : hint_range(0.0, 1.0) = 0.0;
uniform vec2 hex_pos = vec2(0.5, 0.5);
uniform vec3 hex_color = vec3(1.0, 0.35, 0.0);
uniform float time_scale = 1.0;

// Smooth value noise
float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smooth_noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Gentle flowing blobs
float soft_blob(vec2 uv, float t, float scale, float speed) {
	float n1 = smooth_noise(uv * scale + vec2(t * speed, t * speed * 0.6));
	float n2 = smooth_noise(uv * scale * 1.4 + vec2(-t * speed * 0.7, t * speed * 0.9) + 30.0);
	float n3 = smooth_noise(uv * scale * 0.6 + vec2(t * speed * 1.1, -t * speed * 0.4) + 70.0);
	return smoothstep(0.42, 0.58, n1 * 0.5 + n2 * 0.3 + n3 * 0.2 + 0.5);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	float t = TIME * time_scale;

	// Distance from hex center
	vec2 delta = uv - hex_pos;
	float dist = length(delta);

	// Expansion mask — soft, organic edge
	float mask_radius = progress * 3.0;
	float mask_softness = 0.35 + progress * 0.2;
	float mask = 1.0 - smoothstep(mask_radius - mask_softness, mask_radius + mask_softness * 0.3, dist);

	// Soft pastel palette from hex_color
	vec3 base = hex_color;
	vec3 a = vec3(0.5, 0.5, 0.5);
	vec3 b = vec3(0.5, 0.5, 0.5);
	vec3 c = vec3(1.0, 1.0, 1.0);
	vec3 d = vec3(base.r * 0.4 + 0.3, base.g * 0.4 + 0.35, base.b * 0.4 + 0.45);

	// Gentle flowing blobs
	vec2 lava_uv = uv * 2.0;
	float blob1 = soft_blob(lava_uv, t, 2.5, 0.25);
	float blob2 = soft_blob(lava_uv + vec2(2.0, 5.0), t * 0.7, 3.5, 0.2);
	float blob3 = soft_blob(lava_uv + vec2(6.0, 1.5), t * 1.1, 2.0, 0.3);

	float blob_val = blob1 * 0.5 + blob2 * 0.3 + blob3 * 0.2;
	vec3 blob_col = a + b * cos(6.28318 * (c * (blob_val + t * 0.03) + d));

	// Subtle chromatic shift
	float chroma = 0.008 * (1.0 - progress * 0.3);
	float r = soft_blob(uv + vec2(chroma, 0.0), t, 2.5, 0.25);
	float g = soft_blob(uv, t, 2.5, 0.25);
	float b_ch = soft_blob(uv - vec2(chroma, 0.0), t, 2.5, 0.25);
	vec3 chroma_col = vec3(r, g, b_ch);
	blob_col = mix(blob_col, blob_col * chroma_col, 0.15);

	// Very faint scanlines
	float scan = sin(uv.y * 300.0 + t * 1.5) * 0.5 + 0.5;
	blob_col *= mix(0.96, 1.04, scan);

	// Faint holographic grid
	float grid_x = sin(uv.x * 60.0) * 0.5 + 0.5;
	float grid_y = sin(uv.y * 60.0) * 0.5 + 0.5;
	float grid = grid_x * grid_y;
	grid = smoothstep(0.94, 1.0, grid);
	blob_col += vec3(0.08, 0.1, 0.12) * grid * progress * 0.3;

	// Soft edge glow at the mask boundary
	float ring = smoothstep(mask_radius - mask_softness * 0.8, mask_radius - mask_softness * 0.3, dist);
	ring *= 1.0 - smoothstep(mask_radius, mask_radius + mask_softness * 0.4, dist);
	blob_col += base * ring * 0.6;

	// Gentle vignette
	float vig = 1.0 - smoothstep(0.4, 1.5, dist);
	blob_col *= 0.85 + vig * 0.15;

	// Alpha envelope: fade in gently (0→0.15), hold, fade out quickly (0.85→1.0)
	float alpha;
	if (progress < 0.15) {
		alpha = smoothstep(0.0, 0.15, progress);
	} else if (progress > 0.85) {
		alpha = 1.0 - smoothstep(0.85, 1.0, progress);
	} else {
		alpha = 1.0;
	}
	alpha *= 0.55; // Overall transparency — never fully opaque

	COLOR = vec4(blob_col, mask * alpha);
}
