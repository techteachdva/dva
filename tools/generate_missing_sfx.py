import wave, struct, math, os, random

OUT_DIR = r"C:\Users\phili\OneDrive\Desktop\Physix\assets\sounds\sfx"
SAMPLE_RATE = 44100

def save_wav(name, samples):
    path = os.path.join(OUT_DIR, name)
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        w.writeframes(struct.pack('<' + 'h'*len(samples), *samples))

def sine_samples(freq, duration, amp=0.5):
    n = int(SAMPLE_RATE * duration)
    return [int(amp * 32767 * math.sin(2 * math.pi * freq * t / SAMPLE_RATE)) for t in range(n)]

def noise_samples(duration, amp=0.3):
    n = int(SAMPLE_RATE * duration)
    return [int(amp * 32767 * (random.random() * 2 - 1)) for t in range(n)]

def sweep_samples(start_f, end_f, duration, amp=0.5):
    n = int(SAMPLE_RATE * duration)
    samples = []
    for t in range(n):
        progress = t / n
        freq = start_f + (end_f - start_f) * progress
        samples.append(int(amp * 32767 * math.sin(2 * math.pi * freq * t / SAMPLE_RATE)))
    return samples

def envelope(samples, attack=0.01, release=0.1):
    n = len(samples)
    attack_s = int(attack * SAMPLE_RATE)
    release_s = int(release * SAMPLE_RATE)
    out = []
    for i, s in enumerate(samples):
        if i < attack_s:
            env = i / attack_s
        elif i > n - release_s:
            env = (n - i) / release_s
        else:
            env = 1.0
        out.append(int(s * env))
    return out

def mix(a, b):
    n = max(len(a), len(b))
    out = []
    for i in range(n):
        av = a[i] if i < len(a) else 0
        bv = b[i] if i < len(b) else 0
        out.append(max(-32768, min(32767, av + bv)))
    return out

random.seed(42)

# Land: short bassy thud
land = envelope(noise_samples(0.12, 0.4), 0.002, 0.08)
land = mix(land, envelope(sine_samples(80, 0.12, 0.5), 0.002, 0.08))
save_wav("land.wav", land)

# Bump: quick impact
bump = envelope(noise_samples(0.08, 0.5), 0.001, 0.05)
bump = mix(bump, envelope(sine_samples(150, 0.08, 0.4), 0.001, 0.05))
save_wav("bump.wav", bump)

# Brake: short skid noise
brake = envelope(noise_samples(0.20, 0.35), 0.01, 0.10)
brake = mix(brake, envelope(sweep_samples(600, 100, 0.20, 0.3), 0.01, 0.10))
save_wav("brake.wav", brake)

# Unlock: bright magical chime (3 ascending tones)
unlock = []
for f in [880, 1320, 1760]:
    tone = envelope(sine_samples(f, 0.15, 0.25), 0.005, 0.08)
    unlock = mix(unlock, tone)
unlock = mix(unlock, envelope(sine_samples(2200, 0.20, 0.15), 0.01, 0.12))
save_wav("unlock.wav", unlock)

# Wind: soft ambient noise (1 second loop)
wind = []
for _ in range(SAMPLE_RATE):
    wind.append(int(0.10 * 32767 * (random.random() * 2 - 1)))
smoothed = []
for i in range(len(wind)):
    prev = smoothed[-1] if smoothed else 0
    smoothed.append(int(prev * 0.75 + wind[i] * 0.25))
save_wav("wind.wav", smoothed)

print("Generated 5 placeholder SFX files")
