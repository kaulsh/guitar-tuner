# Guitar Tuner

A browser-based guitar tuner (Because I don't like ads).

## How it works

Because I'll forget soon.

### Signal path

```
Microphone
  └─ audio.ts       startAudio() → AnalyserNode (fftSize 4096)
       └─ frequency.ts   detectFrequency() → Hz | null
            └─ pitch-stabiliser.ts   PitchStabiliser.update() → NoteResult | null
                 └─ ui.ts   updateNote() / resetNoteDisplay()
```

### Pitch detection (`frequency.ts`)

The detector runs on every animation frame. Each frame it asks the `AnalyserNode` for the latest 4096-sample snapshot of the microphone signal and tries to find a repeating period in it.

**1. Silence gate**

Before running the correlation algorithm, the signal's RMS energy is calculated. RMS (Root Mean Square) is essentially the average loudness of the waveform — it squares all the samples, averages them, and takes the square root. If the result is below 0.005, the signal is treated as silence or background noise and the function returns `null` immediately. This avoids wasting CPU on the correlation loop when nobody is playing, and prevents returning a garbage frequency from noise.

**2. Frequency bounds**

Rather than searching all possible lags (up to N/2 samples), the search is bounded to lags that correspond to the guitar's actual frequency range. The low E string is ~82 Hz and the high E string is ~330 Hz, so the search covers 40–500 Hz with a little headroom. This reduces the number of iterations per frame significantly.

**3. Difference autocorrelation**

For each candidate lag in that range, the algorithm compares the signal to a copy of itself shifted by that many samples. Instead of multiplying samples together (classical autocorrelation), it sums their absolute differences:

```
d[lag] = sum of |buffer[i] - buffer[i + lag]| for all i
```

A small sum means the signal looks nearly identical to itself at that shift — in other words, the waveform repeats at that lag. A large sum means there is no repetition there. The difference-based approach is more reliable for guitar than multiply-based autocorrelation because guitar strings produce strong harmonics, which can cause multiply-based scores to peak at harmonic lags rather than the fundamental.

**4. CMNDF normalization (YIN-style)**

Raw difference sums are biased: longer lags accumulate more differences simply because there are more samples being compared, so low frequency candidates (large lags) look worse than they really are. To compensate, each lag's score is divided by the cumulative mean of all scores up to that point:

```
cmndf[0] = 1
cmndf[lag] = d[lag] / (runningSum / lag)
```

This normalization — called the Cumulative Mean Normalized Difference Function (CMNDF), from the YIN algorithm — makes the scores at different frequencies directly comparable. A score below 1 means that lag is a better-than-average match.

**5. Peak search**

The normalized scores are scanned from the smallest valid lag upward. The search stops at the first lag where `cmndf < 0.20`. Stopping at the first crossing rather than hunting for a global minimum means the detector naturally picks the fundamental frequency instead of drifting to sub-harmonics or noise valleys at larger lags.

**6. Octave correction**

After finding a candidate lag, the algorithm checks whether half that lag (one octave higher) also has a strong score — specifically, whether `cmndf[halfLag] ≤ cmndf[bestOffset] * 1.2`. If it does, the shorter lag is preferred. This handles the common case where a guitar string's even harmonics are stronger than its fundamental, which can make the detector settle on the period of the second harmonic (half the true lag, double the frequency) rather than the true note.

**7. Parabolic interpolation**

The winning lag is an integer number of samples, but the true period of the waveform almost certainly falls between two samples. At low frequencies this matters: at 82 Hz with a 48 kHz sample rate, each integer step in lag corresponds to roughly 2–3 cents of pitch error, which is visible in a tuner.

To get a fractional lag, a parabola is fitted through the three CMNDF values at `bestOffset - 1`, `bestOffset`, and `bestOffset + 1`. The vertex of that parabola (the analytic minimum) gives a sub-sample correction:

```
shift = (y1 - y3) / (2 * (2*y2 - y1 - y3))
frequency = sampleRate / (bestOffset + shift)
```

---

### Pitch stabilisation (`pitch-stabiliser.ts`)

The raw output of `detectFrequency` is noisy frame to frame — the detected frequency can jump around by tens of Hz even when a string is held steady, and harmonic confusion causes occasional wild outliers. The `PitchStabiliser` class sits between the detector and the display and applies several layers of filtering before showing anything.

**1. Outlier rejection**

Before any smoothing is applied, each incoming frequency is compared to the current smoothed value. If the ratio between the two is less than 0.5 or greater than 2.0 — meaning the new reading is more than an octave away — the frame is thrown away entirely and the display is left unchanged. These extreme jumps are almost always the detector briefly latching onto a harmonic rather than a real pitch change, so discarding them is the right call.

**2. Adaptive EMA smoothing**

Valid frames are fed into an exponential moving average (EMA) to produce a smoothed frequency. Rather than a fixed smoothing coefficient, the rate adapts based on how different the incoming frequency is from the current smoothed value:

- If the difference is more than 10%, the coefficient is 0.50 (fast — the note has changed, catch up quickly).
- If the difference is within 10%, the coefficient is 0.85 (slow — the note is stable, resist small fluctuations).

On a cold start (no prior smoothed frequency), the first valid frame is used directly as the starting value rather than going through the formula.

**3. Majority vote over a history buffer**

The last 10 note names (e.g. `"E"`, `"A"`) are kept in a rolling buffer. Rather than displaying whatever the current smoothed frequency maps to, the stabiliser displays whichever note name appears most often in that buffer. This means a single anomalous frame that maps to the wrong note has almost no effect on what gets shown.

If there is a tie between two note names, the currently confirmed note wins the tie.

**4. Hysteresis**

Winning the majority vote once is not enough to change the displayed note. The winning candidate must hold the majority for a number of consecutive frames. The threshold differs depending on whether a note has already been confirmed:

- **No confirmed note yet (cold start):** 4 consecutive majority frames are required. This gets the display populated quickly after the first strum.
- **Switching from one confirmed note to another:** 8 consecutive majority frames are required. This prevents the display from flickering between adjacent notes (e.g. E and F) when the pitch is near a boundary.

**5. Freeze on decay**

When a string is left to ring out, the signal level drops and `detectFrequency` starts returning `null`. After 20 consecutive null frames, the history buffer and smoothed frequency are both reset so the next detected note gets a clean start without old data pulling it toward the previous note.

Importantly, the confirmed note is *not* cleared when this happens. The last confirmed note stays on the display during the silence so there is something useful to look at. It only disappears if the session is restarted.

---

## Running locally

```sh
pnpm install
pnpm run dev
```

Requires a browser with microphone access (Chrome or Firefox). Grant mic permission when prompted.
