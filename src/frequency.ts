/**
 * [AI GENERATED EXPLANATION OF THE FUNCTION BELOW]
 *
 * detectFrequency — normalized difference autocorrelation frequency detector
 *
 * OVERVIEW
 * --------
 * A guitar string vibrates periodically — the same wave shape repeats over and
 * over at a fixed rate (the frequency). This function finds that repeat rate by
 * looking for the lag (sample offset) at which the signal most closely matches
 * a shifted copy of itself. That lag is the period of the wave in samples, and
 * frequency = sampleRate / period.
 *
 * STEP 1 — COLLECT SAMPLES
 * ------------------------
 * getFloatTimeDomainData() fills a Float32Array with the most recent fftSize
 * samples from the microphone, each in the range [-1, 1]. This is our raw
 * time-domain signal — a snapshot of the waveform.
 *
 * STEP 2 — RMS SILENCE CHECK
 * --------------------------
 * RMS (Root Mean Square) measures the average energy of the signal:
 *
 *   rms = sqrt( sum(sample²) / N )
 *
 * Squaring each sample makes negatives positive (a loud negative sample is
 * just as loud as a loud positive one), averaging gives the mean energy, and
 * the square root brings it back to the original unit. If rms < 0.01 the
 * signal is effectively silence — returning null here avoids running the
 * expensive correlation loop on noise, and prevents returning a garbage
 * frequency when nobody is playing.
 *
 * STEP 3 — FREQUENCY BOUNDS
 * -------------------------
 * Since frequency = sampleRate / offset, clamping the offset range is
 * equivalent to clamping the detectable frequency range:
 *
 *   minOffset = sampleRate / 500  →  ignore anything above ~500 Hz
 *   maxOffset = sampleRate / 50   →  ignore anything below ~50 Hz
 *
 * Guitar open strings span roughly 82 Hz (low E) to 330 Hz (high E), so
 * 50–500 Hz comfortably covers the instrument. This also improves performance
 * — instead of iterating all N/2 possible lags, we only loop the ~350 offsets
 * that correspond to real guitar frequencies. At 60fps this saving compounds.
 *
 * STEP 4 — NORMALIZED DIFFERENCE AUTOCORRELATION (inner loop)
 * -----------------------------------------------------------
 * For each candidate offset (lag), we measure how similar the signal is to a
 * copy of itself shifted by that many samples. Rather than multiplying samples
 * together (classical autocorrelation), we measure their absolute difference:
 *
 *   sum += |buffer[i] - buffer[i + offset]|
 *   correlation = 1 - sum / maxSamples
 *
 * A small difference means the two signals match → score close to 1.
 * A large difference means they don't match → score close to 0.
 *
 * This approach is more robust for guitar than multiply-based autocorrelation.
 * Guitars produce a rich harmonic series (multiples of the fundamental), which
 * causes multiply-based correlation scores to stay below typical thresholds
 * even at the correct lag. The difference-based score reliably reaches > 0.9
 * at the true period because it only cares about how close the values are, not
 * their absolute magnitude.
 *
 * STEP 5 — FINDING THE PEAK
 * -------------------------
 * We're looking for the first strong peak past the trivial lag=0 case.
 * Two conditions must both be true to qualify:
 *
 *   correlation > 0.9          — the match must be very strong (not noise)
 *   correlation > lastCorrelation — the score must still be rising (we want
 *                                   the peak, not the approach to it)
 *
 * Once foundGoodCorrelation is true and the score starts falling, we've passed
 * the peak — we break immediately rather than continuing to loop. This prevents
 * accidentally latching onto a later harmonic peak, and exits early for
 * performance.
 *
 * STEP 6 — PARABOLIC INTERPOLATION
 * ---------------------------------
 * The buffer is made of discrete samples, so bestOffset is an integer. The
 * true correlation peak almost certainly falls between two samples. At low
 * frequencies this integer rounding introduces meaningful cents error — for
 * example at 82 Hz, rounding by just one sample shifts the result by ~2.7
 * cents, which is visible in a tuner.
 *
 * Parabolic interpolation fits a parabola through the three points surrounding
 * the peak (bestOffset-1, bestOffset, bestOffset+1) and finds its vertex
 * analytically. Near any smooth peak, a parabola is a good local approximation.
 * The vertex of a parabola through three equally-spaced points at x = -1, 0, 1
 * is:
 *
 *   shift = (y1 - y3) / (2 * (2*y2 - y1 - y3))
 *
 * y1 - y3 is the slope asymmetry — if the curve is symmetric, shift = 0.
 * If y1 > y3 the true peak is slightly left of bestOffset, so shift is
 * negative. The denominator measures curvature. The result is a fractional
 * correction, typically ±0.5 samples, which is added to bestOffset before
 * computing frequency:
 *
 *   frequency = sampleRate / (bestOffset + shift)
 *
 * Two guard clauses prevent edge case failures: denom !== 0 avoids division
 * by zero if the three points are collinear, and Number.isFinite(shift) catches
 * any NaN that slips through, falling back to the unrefined integer offset.
 */
export function detectFrequency(analyser: AnalyserNode): number | null {
  const sampleRate = analyser.context.sampleRate;

  const buffer = new Float32Array(analyser.fftSize);

  analyser.getFloatTimeDomainData(buffer);

  const SIZE = buffer.length;
  const maxSamples = Math.floor(SIZE / 2);

  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  const minOffset = Math.max(2, Math.floor(sampleRate / 500));
  const maxOffset = Math.min(maxSamples - 1, Math.floor(sampleRate / 50));

  const correlations = new Float32Array(maxOffset + 1);

  let bestOffset = -1;
  let bestCorrelation = 0;
  let lastCorrelation = 1;
  let foundGoodCorrelation = false;

  for (let offset = minOffset; offset <= maxOffset; offset++) {
    let sum = 0;
    for (let i = 0; i < maxSamples; i++) {
      sum += Math.abs(buffer[i] - buffer[i + offset]);
    }
    const correlation = 1 - sum / maxSamples;
    correlations[offset] = correlation;

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true;
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    } else if (foundGoodCorrelation) {
      const y1 = correlations[bestOffset - 1];
      const y2 = correlations[bestOffset];
      const y3 = correlations[bestOffset + 1];
      const denom = 2 * (2 * y2 - y1 - y3);
      const shift = denom !== 0 ? (y1 - y3) / denom : 0;
      const tunedOffset = bestOffset + (Number.isFinite(shift) ? shift : 0);
      const period = tunedOffset / sampleRate;
      return 1 / period;
    }

    lastCorrelation = correlation;
  }

  if (bestOffset !== -1 && bestCorrelation > 0.01) {
    const period = bestOffset / sampleRate;
    return 1 / period;
  }

  return null;
}
