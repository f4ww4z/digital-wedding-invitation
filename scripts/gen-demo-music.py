#!/usr/bin/env python3
"""Synthesize the original demo track (music-box waltz, D major, 3/4) as a WAV.
Composed and rendered here, so it is free of third-party rights. Pure stdlib."""
import math, struct, sys, wave, random

SR = 32000
BPM = 84
BEAT = 60 / BPM
out = sys.argv[1] if len(sys.argv) > 1 else 'music.wav'

def hz(n):  # MIDI note -> Hz
    return 440 * 2 ** ((n - 69) / 12)

# Chords per bar (root MIDI, quality), 16-bar form: I vi IV V | I iii IV V | vi IV I V | IV V I I
D, Bm, G, A, Fsm, Em = (50, 'M'), (47, 'm'), (43, 'M'), (45, 'M'), (42, 'm'), (40, 'm')
prog = [D, Bm, G, A, D, Fsm, G, A, Bm, G, D, A, G, A, D, D]
def triad(root, q):
    return [root, root + (4 if q == 'M' else 3), root + 7]

# Melody: (bar, beat, midi, beats) — an original tune.
mel = [
    (0,0,78,2),(0,2,76,1),(1,0,74,2),(1,2,71,1),(2,0,71,1),(2,1,74,1),(2,2,79,1),(3,0,78,2),(3,2,76,1),
    (4,0,74,1),(4,1,76,1),(4,2,78,1),(5,0,81,2),(5,2,78,1),(6,0,79,1),(6,1,78,1),(6,2,76,1),(7,0,76,3),
    (8,0,74,1),(8,1,78,1),(8,2,83,1),(9,0,83,2),(9,2,81,1),(10,0,78,1),(10,1,81,1),(10,2,78,1),(11,0,76,3),
    (12,0,79,1),(12,1,83,1),(12,2,81,1),(13,0,79,1),(13,1,78,1),(13,2,76,1),(14,0,74,3),(15,0,74,2),(15,2,73,1),
]

bars = len(prog)
total_beats = bars * 3
n = int(total_beats * BEAT * SR)
buf = [0.0] * (n + SR * 3)

def pluck(t0, midi, dur, amp):
    f = hz(midi)
    start = int(t0 * SR)
    length = int(min(dur + 1.6, 3.2) * SR)
    # music-box timbre: fundamental + octave + inharmonic tine partial, fast attack, exp decay
    for i in range(length):
        t = i / SR
        env = (1 - math.exp(-t * 400)) * math.exp(-t * 2.4)
        s = (math.sin(2 * math.pi * f * t)
             + 0.35 * math.sin(2 * math.pi * 2 * f * t) * math.exp(-t * 3)
             + 0.12 * math.sin(2 * math.pi * 4.2 * f * t) * math.exp(-t * 8))
        j = start + i
        if j < len(buf):
            buf[j] += amp * env * s

rnd = random.Random(7)
for bar, (root, q) in enumerate(prog):
    t = bar * 3 * BEAT
    ch = triad(root, q)
    pluck(t, ch[0] - 12 + 12, 3 * BEAT, 0.18)                 # bass on 1
    for beat in (1, 2):                                       # chord on 2 and 3
        for k, note in enumerate(ch):
            pluck(t + beat * BEAT + k * 0.012, note + 12, BEAT, 0.07)
for bar, beat, midi, beats in mel:
    t = (bar * 3 + beat) * BEAT + rnd.uniform(-0.004, 0.004)
    pluck(t, midi, beats * BEAT, 0.26)

# Wrap the decaying tail back to the start so the loop is seamless.
for i in range(len(buf) - n):
    buf[i] += buf[n + i]
buf = buf[:n]

peak = max(abs(x) for x in buf) or 1
with wave.open(out, 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(x / peak * 0.85 * 32767)) for x in buf))
print(f'wrote {out}: {n / SR:.1f}s')
