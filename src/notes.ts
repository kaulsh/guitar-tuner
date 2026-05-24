const NOTES = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];

/**
 * [AI GENERATED EXPLANATION OF THE FUNCTION BELOW]
 *
 * getNoteFromFrequency — converts a frequency in Hz to a note name, octave, and cents offset
 *
 * OVERVIEW
 * --------
 * Given a raw frequency from the pitch detector, this function answers three
 * questions: what is the nearest musical note, which octave is it in, and how
 * far off (in cents) is the frequency from that note's ideal pitch. These three
 * values are everything a tuner display needs.
 *
 * STEP 1 — FREQUENCY TO SEMITONES
 * --------------------------------
 * Musical pitch is logarithmic — each octave is a doubling of frequency, and
 * each octave divides into 12 equal semitones. To count how many semitones
 * above or below A4 (440 Hz) a frequency sits:
 *
 *   semitones = 12 * log2(freq / 440)
 *
 * freq / 440 gives the ratio to A4. log2 counts how many doublings that ratio
 * represents (i.e. how many octaves). Multiplying by 12 converts octaves to
 * semitones. The result is a continuous decimal — 2.3 means "2.3 semitones
 * above A4", which is slightly sharp of B4. Negative values are below A4.
 *
 * Some reference points:
 *   440 Hz  →   0.0  (A4, exactly)
 *   880 Hz  →  12.0  (A5, one octave up)
 *   220 Hz  → -12.0  (A3, one octave down)
 *   494 Hz  →   2.0  (B4, exactly)
 *   82 Hz   → -28.0  (E2, low E string)
 *
 * STEP 2 — NEAREST NOTE
 * ----------------------
 * Rounding the semitone value to the nearest integer snaps the continuous
 * pitch measurement to the nearest note on the chromatic scale:
 *
 *   rounded = Math.round(semitones)
 *
 * So 2.3 → 2 (B4) and 1.7 → 2 (also B4). The decimal remainder is the tuning
 * error — how far the played pitch is from perfect.
 *
 * STEP 3 — CENTS OFFSET
 * ----------------------
 * The difference between the raw semitone value and the rounded value is the
 * tuning error in semitones. Multiplying by 100 converts to cents, the standard
 * unit for small pitch differences (100 cents = 1 semitone):
 *
 *   cents = (semitones - rounded) * 100
 *
 * The result always sits between -50 and +50. If it exceeded ±50, Math.round
 * would have chosen the adjacent note instead. Negative = flat, positive =
 * sharp. This is the number that drives the tuner needle in the UI.
 *
 * STEP 4 — NOTE NAME
 * ------------------
 * The 12 notes of the chromatic scale are stored in an array starting from A,
 * matching our A4 = 440 Hz reference:
 *
 *   ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']
 *
 * rounded % 12 maps any semitone count to an index 0–11. The double-mod
 * pattern ((n % 12) + 12) % 12 is necessary because JS's % operator returns
 * negative results for negative inputs — without the correction, frequencies
 * below A4 would produce a negative index and return undefined:
 *
 *   rounded =  2  →  2 % 12        = 2   →  'B'   (correct)
 *   rounded = -10 →  -10 % 12      = -10 →  undefined (broken)
 *   rounded = -10 →  (-10+12) % 12 = 2   →  'B'   (correct)
 *
 * STEP 5 — OCTAVE NUMBER
 * -----------------------
 * Octave numbers in scientific pitch notation increment at C, not at A — C4
 * sits above A4 in pitch order but carries a higher octave number. Since our
 * semitone scale is anchored at A, we shift by 9 semitones (the distance from
 * A up to C) before dividing into groups of 12:
 *
 *   octave = 4 + Math.floor((rounded + 9) / 12)
 *
 * The +9 shift aligns the 12-note groupings so they break at C rather than A.
 * Math.floor handles negative values correctly — frequencies below A4 produce
 * negative rounded values and still resolve to the right octave:
 *
 *   rounded =  0  →  floor( 9/12) = 0  →  octave 4  (A4)
 *   rounded =  3  →  floor(12/12) = 1  →  octave 5  (C5)
 *   rounded = -9  →  floor( 0/12) = 0  →  octave 4  (C4)
 *   rounded = -12 →  floor(-3/12) = -1 →  octave 3  (A3)
 */
export function getNoteFromFrequency(frequency: number) {
  const semitones = 12 * Math.log2(frequency / 440);

  const rounded = Math.round(semitones);

  const cents = (semitones - rounded) * 100;

  const noteIndex = ((rounded % 12) + 12) % 12;

  const note = NOTES[noteIndex];

  const octave = 4 + Math.floor((rounded + 9) / 12);

  return { note, octave, cents };
}
