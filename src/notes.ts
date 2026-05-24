export type NoteResult = {
  note: string;
  octave: number;
  cents: number;
};

export function getNoteFromFrequency(freq: number): NoteResult {
  throw new Error("Not implemented");
}
