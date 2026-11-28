"""GB-5 Flooded Archive sounds. All synthesized here (numpy), no third-party audio, except the bed's base layer,
which is the already-credited CC0 cellar recording (kyles, freesound 454170) shipped as ambience/archive.ogg.
 - ambience/archive13.ogg   24 s loop: archive.ogg low-passed + a submerged fluorescent hum (49 Hz + harmonics,
                            slow beating) + three distant page turns played backwards
 - sfx/sfx_keeper_clunk.ogg  a stilt set down in water: low knock + a short muffled slosh
 - sfx/sfx_dez_breath.ogg    one slow sleeping breath (in, out), 4.2 s, looped by the game; stops when Dez wakes
 - sfx/sfx_dez_wake.ogg      a short caught breath (the wake)
 - sfx/sfx_filed.ogg         a soft rubber stamp + paper slide (Noor filed by the lamp)
usage: python3 archive13_sound.py   (needs ffmpeg)"""
import os, subprocess, tempfile, wave
import numpy as np
H = os.path.dirname(os.path.abspath(__file__)) + '/../../game/public/assets/'
SR = 44100
rng = np.random.default_rng(13)

def lowpass(x, fc):
    # one-pole, applied twice (12 dB/oct)
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x)
    for _ in range(2):
        acc = 0.0
        for i in range(len(x)): acc = (1 - a) * x[i] + a * acc; y[i] = acc
        x = y.copy()
    return y

def lp_fast(x, fc):
    # FFT brickwall-ish low-pass with a soft knee (fast for long buffers)
    X = np.fft.rfft(x, axis=0); f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    k = 1 / (1 + (f / fc) ** 4)
    return np.fft.irfft(X * (k[:, None] if X.ndim == 2 else k), n=x.shape[0], axis=0)

def bp_fast(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    k = (1 / (1 + (lo / np.maximum(f, 1)) ** 4)) * (1 / (1 + (f / hi) ** 4))
    return np.fft.irfft(X * k, n=len(x))

def env(n, a, d):
    t = np.arange(n) / SR; e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d); return e

def write_ogg(path, x, q=4):
    x = np.clip(x, -1, 1); st = x if x.ndim == 2 else np.stack([x, x], 1)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f: tmp = f.name
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'libvorbis', '-q:a', str(q), path], check=True); os.unlink(tmp)

def read_ogg(path):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', path, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, '<i2').reshape(-1, 2).astype(np.float32) / 32768

def page_turn(n):
    x = rng.normal(0, 1, n); x = bp_fast(x, 900, 5200)
    t = np.arange(n) / SR; e = np.exp(-((t - 0.18) / 0.09) ** 2) + 0.5 * np.exp(-((t - 0.32) / 0.05) ** 2)
    return x * e

def bed():
    base = read_ogg(H + 'ambience/archive.ogg'); L = 24 * SR
    base = np.resize(base, (L, 2)) if len(base) < L else base[:L]
    base = lp_fast(base, 1400) * 0.9
    t = np.arange(L) / SR
    # hum: 49 Hz fundamental (an integer number of cycles over 24 s keeps the loop seamless), 2nd/3rd harmonics, slow beat
    hum = (np.sin(2 * np.pi * 49 * t) * 0.55 + np.sin(2 * np.pi * 98 * t) * 0.22 + np.sin(2 * np.pi * 147.0 * t) * 0.08)
    hum *= 0.75 + 0.25 * np.sin(2 * np.pi * t / 6.0)
    hum = lp_fast(hum, 220) * 0.10
    pages = np.zeros(L)
    for at in (3.1, 11.7, 19.4):
        n = int(0.5 * SR); p = page_turn(n)[::-1] * 0.05; i = int(at * SR); pages[i:i + n] += p
    pages = lp_fast(pages, 2600)
    mix = base + np.stack([hum + pages * 0.8, hum + pages * 1.0], 1)
    # loop seam: 0.4 s crossfade of tail into head
    xf = int(0.4 * SR); w = np.linspace(0, 1, xf)[:, None]
    mix[:xf] = mix[:xf] * w + mix[-xf:] * (1 - w)
    mix = mix[:L - xf] if False else mix
    return mix / max(1e-6, np.abs(mix).max()) * 0.6

def clunk():
    n = int(0.7 * SR); t = np.arange(n) / SR
    knock = np.sin(2 * np.pi * (70 + 40 * np.exp(-t / 0.03)) * t) * env(n, 0.002, 0.09)
    wood = bp_fast(rng.normal(0, 1, n), 300, 1400) * env(n, 0.001, 0.025) * 0.5
    slosh = lp_fast(rng.normal(0, 1, n), 700) * (np.exp(-((t - 0.16) / 0.08) ** 2)) * 0.9
    x = knock * 0.8 + wood + slosh
    return x / np.abs(x).max() * 0.7

def breath():
    n = int(4.2 * SR); t = np.arange(n) / SR
    nz = bp_fast(rng.normal(0, 1, n), 250, 1800)
    e = 0.55 * np.exp(-((t - 0.9) / 0.45) ** 2) + 1.0 * np.exp(-((t - 2.35) / 0.6) ** 2)
    x = nz * e
    return x / np.abs(x).max() * 0.35

def wake():
    n = int(0.9 * SR); t = np.arange(n) / SR
    nz = bp_fast(rng.normal(0, 1, n), 400, 2600)
    e = np.exp(-((t - 0.18) / 0.07) ** 2) * 1.0 + 0.4 * np.exp(-((t - 0.55) / 0.15) ** 2)
    x = nz * e
    return x / np.abs(x).max() * 0.45

def filed():
    n = int(0.8 * SR); t = np.arange(n) / SR
    stamp = lp_fast(rng.normal(0, 1, n), 500) * env(n, 0.002, 0.05) + np.sin(2 * np.pi * 95 * t) * env(n, 0.002, 0.07) * 0.6
    slide = bp_fast(rng.normal(0, 1, n), 1200, 5000) * np.exp(-((t - 0.42) / 0.14) ** 2) * 0.35
    x = stamp + slide
    return x / np.abs(x).max() * 0.6

if __name__ == '__main__':
    write_ogg(H + 'ambience/archive13.ogg', bed(), 3)
    write_ogg(H + 'sfx/sfx_keeper_clunk.ogg', clunk())
    write_ogg(H + 'sfx/sfx_dez_breath.ogg', breath())
    write_ogg(H + 'sfx/sfx_dez_wake.ogg', wake())
    write_ogg(H + 'sfx/sfx_filed.ogg', filed())
    print('archive13 sounds ok')
