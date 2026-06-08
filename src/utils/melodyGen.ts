import { Note, NoteDuration, TimeSignature, Difficulty, MusicStyle } from '../types';
import { BEAT_MAP } from './AudioEngine';

// Chromatic base scale starting at C
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Scale Intervals relative to root
export const SCALE_FORMULAS: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Ionian': [0, 2, 4, 5, 7, 9, 11],
  'Dorian': [0, 2, 3, 5, 7, 9, 10],
  'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  'Lydian': [0, 2, 4, 6, 7, 9, 11],
  'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'Aeolian': [0, 2, 3, 5, 7, 8, 10],
  'Locrian': [0, 1, 3, 5, 6, 8, 10],
};

// Interval semitones mapping
const DIFFICULTY_LEAPS: Record<Difficulty, number> = {
  beginner: 2,      // Major/minor 2nd (stepwise)
  intermediate: 4,  // Up to major 3rd
  advanced: 7,      // Up to perfect 5th
  expert: 12,       // Up to octave (any leap)
};

// Helper: Get notes in a scale for octaves 4 and 5
export function getScaleNotes(root: string, scaleName: string): string[] {
  const rootIndex = CHROMATIC_NOTES.indexOf(root);
  if (rootIndex === -1) return [];

  const intervals = SCALE_FORMULAS[scaleName] || SCALE_FORMULAS['Major'];
  const notes: string[] = [];

  // Octaves 4 and 5 represent standard melody training ranges
  [4, 5].forEach((octave) => {
    intervals.forEach((interval) => {
      const idx = (rootIndex + interval) % 12;
      const noteName = CHROMATIC_NOTES[idx];
      
      // Calculate octave shift
      const resolvedOctave = octave + Math.floor((rootIndex + interval) / 12);
      notes.push(`${noteName}${resolvedOctave}`);
    });
  });

  return Array.from(new Set(notes)); // Remove duplicates if any
}

interface GeneratorParams {
  allowedNotes: string[]; // ['C', 'D#', ...]
  selectedScales: string[]; // ['C Major', 'G Major']
  enabledRhythms: Record<string, boolean>; // { whole: true, half: true, etc. }
  timeSignature: TimeSignature;
  difficulty: Difficulty;
  length: number; // target notes count
  style?: MusicStyle; // AI style
  aiMode?: boolean;
}

export function generateMelody(params: GeneratorParams): Note[] {
  const {
    allowedNotes,
    selectedScales,
    enabledRhythms,
    timeSignature,
    difficulty,
    length,
    style = 'classical',
    aiMode = false,
  } = params;

  // 1. Gather all allowed pitches
  let pool: string[] = [];

  if (selectedScales.length > 0) {
    selectedScales.forEach((scaleStr) => {
      const [root, ...rest] = scaleStr.split(' ');
      const scaleName = rest.join(' ');
      pool.push(...getScaleNotes(root, scaleName));
    });
    // Remove duplicates
    pool = Array.from(new Set(pool));
  } else {
    // Fallback to chromatic in octave 4 and 5
    [4, 5].forEach((octave) => {
      CHROMATIC_NOTES.forEach((note) => {
        pool.push(`${note}${octave}`);
      });
    });
  }

  // Filter pool by allowed notes checkboxes (letter matching, e.g., 'C#4' matches 'C#')
  if (allowedNotes.length > 0) {
    const filteredPool = pool.filter((pitch) => {
      const letter = pitch.replace(/\d+$/, ''); // Extract pitch name, strip octave
      return allowedNotes.includes(letter);
    });
    
    // If intersection has notes, use it; otherwise fallback to full scale pool to avoid crash
    if (filteredPool.length > 0) {
      pool = filteredPool;
    }
  }

  // Ensure pool is not empty
  if (pool.length === 0) {
    pool = ['C4', 'E4', 'G4', 'C5'];
  }

  // 2. Parse time signature configurations
  const [numStr, denStr] = timeSignature.split('/');
  const beatsPerMeasure = parseInt(numStr, 10);
  const beatValue = parseInt(denStr, 10);
  const beatsPerBar = beatsPerMeasure * (4 / beatValue);

  // 3. Setup enabled rhythms
  const durationPool: NoteDuration[] = [];
  if (enabledRhythms.whole) durationPool.push('w');
  if (enabledRhythms.half) durationPool.push('h');
  if (enabledRhythms.quarter) durationPool.push('q');
  if (enabledRhythms.eighth) durationPool.push('8');
  if (enabledRhythms.sixteenth) durationPool.push('16');
  
  if (enabledRhythms.dotted) {
    if (enabledRhythms.whole) durationPool.push('wd');
    if (enabledRhythms.half) durationPool.push('hd');
    if (enabledRhythms.quarter) durationPool.push('qd');
    if (enabledRhythms.eighth) durationPool.push('8d');
    if (enabledRhythms.sixteenth) durationPool.push('16d');
  }

  // Fallback if no rhythms are enabled
  if (durationPool.length === 0) {
    durationPool.push('q');
  }

  // 4. Generate notes and measures
  const notes: Note[] = [];
  let currentMeasureBeats = 0;
  const maxLeap = DIFFICULTY_LEAPS[difficulty];
  let previousPitchIndex = Math.floor(pool.length / 2); // Start in middle

  // Algorithmic style settings (for AI Mode)
  let popRepetitionCounter = 0;
  let popMotif: Note[] = [];

  const getNextPitch = (): string => {
    let nextIdx = previousPitchIndex;
    
    if (aiMode) {
      // Style-based generation (Markov/algorithmic)
      if (style === 'pop' && popMotif.length > 0 && Math.random() < 0.6) {
        // Pop music: repeat motif patterns
        const motifNote = popMotif[notes.length % popMotif.length];
        return motifNote.pitch === 'R' ? pool[previousPitchIndex] : motifNote.pitch;
      }

      if (style === 'classical') {
        // Classical: strong stepwise motion, preference for tonic/dominant scale degrees
        const isStep = Math.random() < 0.75;
        const step = isStep ? (Math.random() < 0.5 ? -1 : 1) : Math.floor(Math.random() * 5) - 2;
        nextIdx = Math.max(0, Math.min(pool.length - 1, previousPitchIndex + step));
      } else if (style === 'jazz') {
        // Jazz: chromatic leaps, syncopation, blue notes
        const leap = Math.floor(Math.random() * 9) - 4; // larger intervals
        nextIdx = Math.max(0, Math.min(pool.length - 1, previousPitchIndex + leap));
      } else if (style === 'film') {
        // Film: dramatic emotional leaps, soaring octaves or fifths
        if (Math.random() < 0.3) {
          // perfect fifth (+7 semitones) or octave (+12 semitones) approx leaps
          const leap = Math.random() < 0.5 ? 4 : 7; // index leap
          nextIdx = Math.max(0, Math.min(pool.length - 1, previousPitchIndex + (Math.random() < 0.5 ? leap : -leap)));
        } else {
          nextIdx = Math.floor(Math.random() * pool.length);
        }
      } else {
        // Default random index
        nextIdx = Math.floor(Math.random() * pool.length);
      }
    } else {
      // Standard difficulty interval checking
      let attempts = 0;
      let valid = false;
      while (!valid && attempts < 20) {
        const tempIdx = Math.floor(Math.random() * pool.length);
        const pitch1 = pool[previousPitchIndex];
        const pitch2 = pool[tempIdx];
        
        // Find semitone distance
        const p1Name = pitch1.replace(/\d+$/, '');
        const p1Oct = parseInt(pitch1.match(/\d+$/)?.[0] || '4', 10);
        const p2Name = pitch2.replace(/\d+$/, '');
        const p2Oct = parseInt(pitch2.match(/\d+$/)?.[0] || '4', 10);

        const semitones1 = CHROMATIC_NOTES.indexOf(p1Name) + p1Oct * 12;
        const semitones2 = CHROMATIC_NOTES.indexOf(p2Name) + p2Oct * 12;
        const diff = Math.abs(semitones1 - semitones2);

        if (diff <= maxLeap) {
          nextIdx = tempIdx;
          valid = true;
        }
        attempts++;
      }
      if (!valid) {
        // fallback to stepwise motion if we cannot find a leap
        const step = Math.random() < 0.5 ? -1 : 1;
        nextIdx = Math.max(0, Math.min(pool.length - 1, previousPitchIndex + step));
      }
    }

    previousPitchIndex = nextIdx;
    return pool[nextIdx];
  };

  // Generate loop
  while (notes.length < length || currentMeasureBeats > 0) {
    const remainingBeats = beatsPerBar - currentMeasureBeats;

    // If remaining beats is extremely small, fill with a final note/rest of that duration
    if (remainingBeats <= 0.001) {
      currentMeasureBeats = 0;
      continue;
    }

    // Filter duration pool for sizes that fit the current measure
    let validDurations = durationPool.filter((dur) => BEAT_MAP[dur] <= remainingBeats + 0.001);

    // If no configured durations fit, we must force a duration to fill the bar
    if (validDurations.length === 0) {
      // Find the absolute largest division that is <= remainingBeats
      const possibleDurations: NoteDuration[] = ['16', '8', 'q', 'h', 'w'];
      const fitted = possibleDurations.find((dur) => BEAT_MAP[dur] <= remainingBeats + 0.001);
      if (fitted) {
        validDurations = [fitted];
      } else {
        // Fallback to 16th note division as safety
        validDurations = ['16'];
      }
    }

    // Choose random duration
    const chosenDuration = validDurations[Math.floor(Math.random() * validDurations.length)];
    const durationBeats = BEAT_MAP[chosenDuration];

    // Determine if note or rest
    let type: 'note' | 'rest' = 'note';
    if (enabledRhythms.rests && Math.random() < 0.15) {
      type = 'rest';
    }

    const pitch = type === 'rest' ? 'R' : getNextPitch();
    
    const newNote: Note = {
      pitch,
      duration: chosenDuration,
      type,
      isDotted: chosenDuration.endsWith('d'),
    };

    notes.push(newNote);
    currentMeasureBeats += durationBeats;

    // Pop motif construction
    if (style === 'pop' && popMotif.length < 4) {
      popMotif.push(newNote);
    }

    // Close measure boundary if perfectly filled
    if (Math.abs(currentMeasureBeats - beatsPerBar) < 0.001) {
      currentMeasureBeats = 0;
      // Stop generating if we reached or exceeded length on a neat bar boundary
      if (notes.length >= length) {
        break;
      }
    }
  }

  return notes;
}
