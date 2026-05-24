import { getNoteFromFrequency } from "./notes.js";

export type NoteResult = ReturnType<typeof getNoteFromFrequency>;

const HISTORY_SIZE = 10;
const SMOOTHING_ALPHA = 0.15;
const HYSTERESIS_FRAMES = 8;
const DECAY_FRAMES = 20;

export class PitchStabiliser {
  private smoothedFreq: number | null = null;
  private history: string[] = [];
  private confirmedNote: NoteResult | null = null;
  private nullFrameCount = 0;
  private consecutiveMajorityCount = 0;
  private lastMajorityCandidate: string | null = null;

  reset(): void {
    this.smoothedFreq = null;
    this.history = [];
    this.confirmedNote = null;
    this.nullFrameCount = 0;
    this.consecutiveMajorityCount = 0;
    this.lastMajorityCandidate = null;
  }

  update(rawFreq: number | null): NoteResult | null {
    if (rawFreq === null) {
      this.nullFrameCount++;
      if (this.nullFrameCount > DECAY_FRAMES) {
        this.history = [];
        this.smoothedFreq = null;
        this.consecutiveMajorityCount = 0;
        this.lastMajorityCandidate = null;
      }
      return this.confirmedNote;
    }

    this.nullFrameCount = 0;

    if (this.smoothedFreq === null) {
      this.smoothedFreq = rawFreq;
    } else {
      this.smoothedFreq =
        (1 - SMOOTHING_ALPHA) * this.smoothedFreq + SMOOTHING_ALPHA * rawFreq;
    }

    const noteResult = getNoteFromFrequency(this.smoothedFreq);

    this.history.push(noteResult.note);
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }

    const candidate = this.majorityVote();

    if (candidate !== null) {
      if (candidate === this.lastMajorityCandidate) {
        this.consecutiveMajorityCount++;
      } else {
        this.lastMajorityCandidate = candidate;
        this.consecutiveMajorityCount = 1;
      }

      if (
        this.consecutiveMajorityCount >= HYSTERESIS_FRAMES &&
        (this.confirmedNote === null || this.confirmedNote.note !== candidate)
      ) {
        this.confirmedNote =
          noteResult.note === candidate
            ? noteResult
            : { ...noteResult, note: candidate };
      } else if (
        this.confirmedNote !== null &&
        noteResult.note === this.confirmedNote.note
      ) {
        this.confirmedNote = noteResult;
      }
    }

    return this.confirmedNote;
  }

  private majorityVote(): string | null {
    if (this.history.length === 0) {
      return null;
    }

    const counts = new Map<string, number>();
    for (const name of this.history) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }

    let maxCount = 0;
    const tied: string[] = [];
    for (const [name, count] of counts) {
      if (count > maxCount) {
        maxCount = count;
        tied.length = 0;
        tied.push(name);
      } else if (count === maxCount) {
        tied.push(name);
      }
    }

    if (tied.length === 1) {
      return tied[0];
    }

    if (this.confirmedNote !== null && tied.includes(this.confirmedNote.note)) {
      return this.confirmedNote.note;
    }

    return this.confirmedNote?.note ?? null;
  }
}
