export type TimeSignature = '2/4' | '3/4' | '4/4' | '5/4' | '6/8' | '7/8' | '9/8' | '12/8';

export type InstrumentType = 'piano' | 'violin' | 'flute' | 'guitar' | 'synth';

export type PlaybackMode = 'manual' | 'auto-repeat' | 'slow' | 'call-and-response';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type MusicStyle = 'classical' | 'film' | 'carnatic' | 'jazz' | 'pop';

export type NoteDuration = 'w' | 'h' | 'q' | '8' | '16' | 'wd' | 'hd' | 'qd' | '8d' | '16d';

export interface Note {
  pitch: string; // E.g., 'C4', 'D#4', 'R' (for rest)
  duration: NoteDuration; // VexFlow/Tone.js friendly: 'w', 'h', 'q', '8', '16', etc.
  type: 'note' | 'rest';
  isDotted?: boolean;
  swara?: string; // Carnatic Swara (Sa, Ri, Ga...)
}

export interface Scale {
  id: string;
  name: string;
  root: string;
  intervals: number[]; // semitone steps from root
}

export interface Stats {
  completed: number;
  accuracySum: number;
  bestScore: number;
  weakIntervals: Record<string, number>; // interval -> count of errors
  weakRhythms: Record<string, number>; // rhythm type -> count of errors
  practiceStreak: number;
  lastPracticeDate: string; // YYYY-MM-DD
  totalTimeSpentSec?: number;
  totalQuestionsAnswered?: number;
  totalCorrectQuestions?: number;
}

export interface CustomExercise {
  id: string;
  title: string;
  description: string;
  timeSignature: TimeSignature;
  notes: Note[];
  tempo: number;
  scale?: string;
  difficulty: Difficulty;
  instrument: InstrumentType;
}

export interface CarnaticRaga {
  name: string;
  melakarta?: number;
  arohana: string[]; // Sa Ri Ga Ma Pa Dha Ni Sa
  avarohana: string[];
  notes: string[]; // exact MIDI names mapped from Sa (e.g. C4, D4, E4...)
}

export interface SavedExerciseSet {
  id: string;
  title: string;
  exercises: CustomExercise[];
  shareCode?: string;
}
