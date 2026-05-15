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

# ── Generate SFX ────────────────────────────────────────────────────────────

# Jump: quick upward sweep
jump = envelope(sweep_samples(300, 900, 0.18, 0.4), 0.01, 0.08)
save_wav("jump.wav", jump)

# Land: short low thud
land = envelope(noise_samples(0.15, 0.5), 0.005, 0.1)
land = mix(land, envelope(sine_samples(120, 0.15, 0.4), 0.005, 0.1))
save_wav("land.wav", land)

# Coin: bright two-tone chime
coin = envelope(sine_samples(1200, 0.08, 0.35), 0.005, 0.06)
coin = mix(coin, envelope(sine_samples(1800, 0.08, 0.25), 0.005, 0.06))
save_wav("coin.wav", coin)

# Boost: longer upward sweep
boost = envelope(sweep_samples(400, 1200, 0.35, 0.45), 0.02, 0.15)
boost = mix(boost, envelope(sine_samples(800, 0.35, 0.2), 0.02, 0.15))
save_wav("boost.wav", boost)

# Bump: short collision thud
bump = envelope(noise_samples(0.10, 0.45), 0.002, 0.06)
bump = mix(bump, envelope(sine_samples(80, 0.10, 0.5), 0.002, 0.06))
save_wav("bump.wav", bump)

# Brake: short screech/skid noise
brake = envelope(noise_samples(0.25, 0.4), 0.02, 0.12)
brake = mix(brake, envelope(sweep_samples(800, 200, 0.25, 0.25), 0.02, 0.12))
save_wav("brake.wav", brake)

# Checkpoint: pleasant confirmation beep
checkpoint = envelope(sine_samples(880, 0.12, 0.35), 0.01, 0.05)
checkpoint = mix(checkpoint, envelope(sine_samples(1320, 0.12, 0.2), 0.01, 0.05))
save_wav("checkpoint.wav", checkpoint)

# Complete: victory arpeggio
complete = []
for f in [523, 659, 784, 1047]:
    complete = mix(complete, envelope(sine_samples(f, 0.20, 0.3), 0.01, 0.1))
save_wav("level_complete.wav", complete)

# Unlock: magical chime
unlock = envelope(sine_samples(1000, 0.25, 0.35), 0.01, 0.15)
unlock = mix(unlock, envelope(sine_samples(1500, 0.25, 0.2), 0.01, 0.15))
unlock = mix(unlock, envelope(sine_samples(2000, 0.25, 0.15), 0.01, 0.15))
save_wav("unlock.wav", unlock)

# Death: descending tone
death = envelope(sweep_samples(600, 100, 0.45, 0.45), 0.01, 0.2)
death = mix(death, envelope(noise_samples(0.45, 0.2), 0.01, 0.2))
save_wav("death.wav", death)

# Wind: soft ambient noise loop (1 second seamless-ish)
random.seed(42)
wind = []
for _ in range(SAMPLE_RATE):
    wind.append(int(0.12 * 32767 * (random.random() * 2 - 1)))
# Gentle low-pass-ish smoothing
smoothed = []
for i in range(len(wind)):
    prev = smoothed[-1] if smoothed else 0
    smoothed.append(int(prev * 0.7 + wind[i] * 0.3))
save_wav("wind_loop.wav", smoothed)

print("Generated 11 placeholder SFX files in", OUT_DIR)
