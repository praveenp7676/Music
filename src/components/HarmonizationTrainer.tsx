import React, { useState, useEffect } from 'react';
import { Note, NoteDuration, TimeSignature, InstrumentType, Difficulty, PlaybackMode } from '../types';
import { SheetMusic } from './SheetMusic';
import { audioEngine, BEAT_MAP } from '../utils/AudioEngine';
import { Play, Square, RefreshCw, Volume2, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';

interface HarmonizationTrainerProps {
  onAddScore: (accuracy: number, timeTakenSec?: number, subCorrect?: number, subTotal?: number) => void;
}

interface SessionHistoryItem {
  id: number;
  questionLabel: string;
  isCorrect: boolean;
  timeTakenSec: number;
}

interface DiatonicChord {
  degree: string;
  name: string;
  semitoneOffset: number;
  intervals: number[];
  roman: string;
}

interface ChordProgression {
  name: string;
  degrees: number[];
}

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALE_FORMULAS: Record<string, number[]> = {
  'Major': [0, 2, 4, 5, 7, 9, 11],
  'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
};

const DIFFICULTY_LEAPS: Record<Difficulty, number> = {
  beginner: 2,
  intermediate: 4,
  advanced: 7,
  expert: 12,
};

const MAJOR_DIATONIC_CHORDS: DiatonicChord[] = [
  { degree: 'I', name: 'Major', semitoneOffset: 0, intervals: [0, 4, 7], roman: 'I' },
  { degree: 'ii', name: 'minor', semitoneOffset: 2, intervals: [0, 3, 7], roman: 'ii' },
  { degree: 'iii', name: 'minor', semitoneOffset: 4, intervals: [0, 3, 7], roman: 'iii' },
  { degree: 'IV', name: 'Major', semitoneOffset: 5, intervals: [0, 4, 7], roman: 'IV' },
  { degree: 'V', name: 'Major', semitoneOffset: 7, intervals: [0, 4, 7], roman: 'V' },
  { degree: 'vi', name: 'minor', semitoneOffset: 9, intervals: [0, 3, 7], roman: 'vi' },
  { degree: 'vii°', name: 'diminished', semitoneOffset: 11, intervals: [0, 3, 6], roman: 'vii°' },
];

const MINOR_DIATONIC_CHORDS: DiatonicChord[] = [
  { degree: 'i', name: 'minor', semitoneOffset: 0, intervals: [0, 3, 7], roman: 'i' },
  { degree: 'ii°', name: 'diminished', semitoneOffset: 2, intervals: [0, 3, 6], roman: 'ii°' },
  { degree: 'III', name: 'Major', semitoneOffset: 3, intervals: [0, 4, 7], roman: 'III' },
  { degree: 'iv', name: 'minor', semitoneOffset: 5, intervals: [0, 3, 7], roman: 'iv' },
  { degree: 'v', name: 'minor', semitoneOffset: 7, intervals: [0, 3, 7], roman: 'v' },
  { degree: 'VI', name: 'Major', semitoneOffset: 8, intervals: [0, 4, 7], roman: 'VI' },
  { degree: 'VII', name: 'Major', semitoneOffset: 10, intervals: [0, 4, 7], roman: 'VII' },
];

const MAJOR_PROGRESSIONS: ChordProgression[] = [
  { name: 'I - IV - V - I', degrees: [0, 3, 4, 0] },
  { name: 'I - vi - IV - V', degrees: [0, 5, 3, 4] },
  { name: 'I - V - vi - IV', degrees: [0, 4, 5, 3] },
  { name: 'ii - V - I - I', degrees: [1, 4, 0, 0] },
  { name: 'I - iii - IV - V', degrees: [0, 2, 3, 4] },
  { name: 'vi - IV - I - V', degrees: [5, 3, 0, 4] },
];

const MINOR_PROGRESSIONS: ChordProgression[] = [
  { name: 'i - iv - VII - i', degrees: [0, 3, 6, 0] },
  { name: 'i - VI - III - VII', degrees: [0, 5, 2, 6] },
  { name: 'i - iv - v - i', degrees: [0, 3, 4, 0] },
  { name: 'i - VII - VI - VII', degrees: [0, 6, 5, 6] },
  { name: 'VI - VII - i - i', degrees: [5, 6, 0, 0] },
];

interface TemplateNote {
  duration: NoteDuration;
  type: 'note' | 'rest';
}

const HUMAN_TEMPLATES: TemplateNote[][] = [
  // 1. Whole note
  [{ duration: 'w', type: 'note' }],

  // 2. Half notes
  [{ duration: 'h', type: 'note' }, { duration: 'h', type: 'note' }],

  // 3. Half and Quarters
  [{ duration: 'h', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'h', type: 'note' }],

  // 4. Quarters
  [{ duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],

  // 5. Dotted Half and Quarter
  [{ duration: 'hd', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: 'hd', type: 'note' }],

  // 6. Dotted Quarter, Eighth, Quarters
  [{ duration: 'qd', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'qd', type: 'note' }, { duration: '8', type: 'note' }],

  // 7. Quarters and Eighths (max 2 consecutive eighths for natural parsing)
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }],
  [{ duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'h', type: 'note' }],
  [{ duration: 'h', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }],

  // 8. Syncopations / skips (Eighth rests) - play, skip (rest), play
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'rest' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }],
  [{ duration: '8', type: 'note' }, { duration: '8', type: 'rest' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'rest' }, { duration: 'h', type: 'note' }],

  // 9. Sixteenth templates (max 2 consecutive sixteenths, combined with rests/longer notes)
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'h', type: 'note' }],
  [{ duration: '16', type: 'note' }, { duration: '16', type: 'rest' }, { duration: '16', type: 'note' }, { duration: '16', type: 'rest' }, { duration: 'q', type: 'note' }, { duration: 'h', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'rest' }, { duration: 'q', type: 'note' }],

  // 10. Mixed templates (mixing q, 8, 16 in a single measure)
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '8', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }],
  [{ duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: 'q', type: 'note' }, { duration: '8', type: 'note' }, { duration: '16', type: 'note' }, { duration: '16', type: 'note' }],
];

const isTemplateValid = (template: TemplateNote[], enabledRhythms: Record<string, boolean>): boolean => {
  return template.every((note) => {
    if (note.type === 'rest' && !enabledRhythms.rests) return false;
    
    const baseDur = note.duration.replace('d', '');
    const isDotted = note.duration.endsWith('d');
    
    if (isDotted && !enabledRhythms.dotted) return false;
    
    if (baseDur === 'w' && !enabledRhythms.whole) return false;
    if (baseDur === 'h' && !enabledRhythms.half) return false;
    if (baseDur === 'q' && !enabledRhythms.quarter) return false;
    if (baseDur === '8' && !enabledRhythms.eighth) return false;
    if (baseDur === '16' && !enabledRhythms.sixteenth) return false;
    
    return true;
  });
};

export const HarmonizationTrainer: React.FC<HarmonizationTrainerProps> = ({ onAddScore }) => {
  const [scaleRoot, setScaleRoot] = useState<string>(() => {
    const saved = localStorage.getItem('harm_scaleRoot');
    return saved ? JSON.parse(saved) : 'C';
  });
  const [scaleType, setScaleType] = useState<'Major' | 'Natural Minor'>(() => {
    const saved = localStorage.getItem('harm_scaleType');
    return saved ? JSON.parse(saved) : 'Major';
  });
  const [instrument, setInstrument] = useState<InstrumentType>(() => {
    const saved = localStorage.getItem('harm_instrument');
    return saved ? JSON.parse(saved) : 'piano';
  });
  const [tempo, setTempo] = useState<number>(() => {
    const saved = localStorage.getItem('harm_tempo');
    return saved ? JSON.parse(saved) : 90;
  });

  const [enabledRhythms, setEnabledRhythms] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('harm_enabledRhythms');
    return saved ? JSON.parse(saved) : {
      whole: true,
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: false,
      dotted: false,
      rests: false,
    };
  });
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = localStorage.getItem('harm_difficulty');
    return saved ? JSON.parse(saved) : 'intermediate';
  });
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(() => {
    const saved = localStorage.getItem('harm_playbackMode');
    return saved ? JSON.parse(saved) : 'manual';
  });

  const [notes, setNotes] = useState<Note[]>([]);
  const [correctSequence, setCorrectSequence] = useState<Array<{ name: string; pitches: string[]; degreeIndex: number; roman: string }>>([]);
  const [progressionName, setProgressionName] = useState<string>('');

  // Selected chords by the user for the 4 measures
  const [userSelectedChords, setUserSelectedChords] = useState<Array<number | null>>([null, null, null, null]);
  const [activeSlot, setActiveSlot] = useState<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  
  const [isAnswered, setIsAnswered] = useState(false);
  const [matchingResults, setMatchingResults] = useState<boolean[]>([]);
  const [quizAccuracy, setQuizAccuracy] = useState<number | null>(null);

  // Time tracking and session stats
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const diatonicChords = scaleType === 'Major' ? MAJOR_DIATONIC_CHORDS : MINOR_DIATONIC_CHORDS;

  // Save Settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('harm_scaleRoot', JSON.stringify(scaleRoot));
    localStorage.setItem('harm_scaleType', JSON.stringify(scaleType));
    localStorage.setItem('harm_instrument', JSON.stringify(instrument));
    localStorage.setItem('harm_tempo', JSON.stringify(tempo));
    localStorage.setItem('harm_enabledRhythms', JSON.stringify(enabledRhythms));
    localStorage.setItem('harm_difficulty', JSON.stringify(difficulty));
    localStorage.setItem('harm_playbackMode', JSON.stringify(playbackMode));
  }, [scaleRoot, scaleType, instrument, tempo, enabledRhythms, difficulty, playbackMode]);

  // Handle Instrument Switch
  useEffect(() => {
    audioEngine.setInstrument(instrument);
  }, [instrument]);

  const handleGenerate = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
    setIsAnswered(false);
    setUserSelectedChords([null, null, null, null]);
    setActiveSlot(0);
    setQuizAccuracy(null);
    setMatchingResults([]);
    setQuestionStartTime(Date.now());

    const rootIndex = CHROMATIC_NOTES.indexOf(scaleRoot);
    const progressionList = scaleType === 'Major' ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;

    // Pick random progression
    const progression = progressionList[Math.floor(Math.random() * progressionList.length)];
    setProgressionName(progression.name);

    const generatedNotes: Note[] = [];
    const generatedChords: Array<{ name: string; pitches: string[]; degreeIndex: number; roman: string }> = [];

    let previousPitch = '';

    progression.degrees.forEach((degIdx) => {
      const chordDef = diatonicChords[degIdx];
      const chordRootIdx = (rootIndex + chordDef.semitoneOffset) % 12;
      const chordRootLetter = CHROMATIC_NOTES[chordRootIdx];

      // Accompaniment chords played on octave 3
      const chordPitches = chordDef.intervals.map((semitones) => {
        const midiVal = 12 * (3 + 1) + rootIndex + chordDef.semitoneOffset + semitones;
        const l = CHROMATIC_NOTES[midiVal % 12];
        const o = Math.floor(midiVal / 12) - 1;
        return `${l}${o}`;
      });

      generatedChords.push({
        name: `${chordRootLetter} ${chordDef.name} (${chordDef.roman})`,
        pitches: chordPitches,
        degreeIndex: degIdx,
        roman: chordDef.roman,
      });

      // Melody notes pool (Octave 4 & 5)
      const chordTonePool: string[] = [];
      [4, 5].forEach((oct) => {
        chordDef.intervals.forEach((semitones) => {
          const midiVal = 12 * (oct + 1) + rootIndex + chordDef.semitoneOffset + semitones;
          const l = CHROMATIC_NOTES[midiVal % 12];
          const o = Math.floor(midiVal / 12) - 1;
          chordTonePool.push(`${l}${o}`);
        });
      });

      const scaleIntervals = SCALE_FORMULAS[scaleType] || SCALE_FORMULAS['Major'];
      const scaleTonePool: string[] = [];
      [4, 5].forEach((oct) => {
        scaleIntervals.forEach((semitones) => {
          const midiVal = 12 * (oct + 1) + rootIndex + semitones;
          const l = CHROMATIC_NOTES[midiVal % 12];
          const o = Math.floor(midiVal / 12) - 1;
          scaleTonePool.push(`${l}${o}`);
        });
      });

      const maxLeap = DIFFICULTY_LEAPS[difficulty] || 4;

      // Try to choose a human phrased template
      let validTemplates = HUMAN_TEMPLATES.filter((t) => isTemplateValid(t, enabledRhythms));

      if (validTemplates.length > 0) {
        // Calculate the variety (number of unique enabled rhythms used) for each valid template
        const getVariety = (template: TemplateNote[]): number => {
          const uniq = new Set<string>();
          template.forEach((n) => {
            uniq.add(n.duration.replace('d', ''));
          });
          return uniq.size;
        };

        const maxVariety = Math.max(...validTemplates.map(getVariety));
        
        // Filter to templates that match this maximum variety to ensure mixed notes in the bar
        validTemplates = validTemplates.filter((t) => getVariety(t) === maxVariety);

        // Choose random template from the subset with maximum variety
        const template = validTemplates[Math.floor(Math.random() * validTemplates.length)];
        let isFirstNoteInMeasure = true;

        template.forEach((tempNote) => {
          let pitch = 'R';
          if (tempNote.type === 'note') {
            let targetPool = isFirstNoteInMeasure ? chordTonePool : (Math.random() < 0.6 ? chordTonePool : scaleTonePool);
            if (targetPool.length === 0) targetPool = scaleTonePool;
            isFirstNoteInMeasure = false;

            let nextPitch = '';
            let attempts = 0;
            let valid = false;

            while (!valid && attempts < 20) {
              const tempPitch = targetPool[Math.floor(Math.random() * targetPool.length)];
              if (!previousPitch) {
                valid = true;
                nextPitch = tempPitch;
                break;
              }

              const p1Name = previousPitch.replace(/\d+$/, '');
              const p1Oct = parseInt(previousPitch.match(/\d+$/)?.[0] || '4', 10);
              const p2Name = tempPitch.replace(/\d+$/, '');
              const p2Oct = parseInt(tempPitch.match(/\d+$/)?.[0] || '4', 10);

              const semitones1 = CHROMATIC_NOTES.indexOf(p1Name) + p1Oct * 12;
              const semitones2 = CHROMATIC_NOTES.indexOf(p2Name) + p2Oct * 12;
              const diff = Math.abs(semitones1 - semitones2);

              if (diff <= maxLeap) {
                nextPitch = tempPitch;
                valid = true;
              }
              attempts++;
            }

            if (!valid) {
              if (previousPitch) {
                const p1Name = previousPitch.replace(/\d+$/, '');
                const p1Oct = parseInt(previousPitch.match(/\d+$/)?.[0] || '4', 10);
                const semitones1 = CHROMATIC_NOTES.indexOf(p1Name) + p1Oct * 12;
                
                let closestPitch = targetPool[0];
                let minDiff = 999;
                targetPool.forEach((tempPitch) => {
                  const p2Name = tempPitch.replace(/\d+$/, '');
                  const p2Oct = parseInt(tempPitch.match(/\d+$/)?.[0] || '4', 10);
                  const semitones2 = CHROMATIC_NOTES.indexOf(p2Name) + p2Oct * 12;
                  const diff = Math.abs(semitones1 - semitones2);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestPitch = tempPitch;
                  }
                });
                nextPitch = closestPitch;
              } else {
                nextPitch = targetPool[0];
              }
            }

            pitch = nextPitch;
            previousPitch = nextPitch;
          }

          generatedNotes.push({
            pitch,
            duration: tempNote.duration,
            type: tempNote.type,
            isDotted: tempNote.duration.endsWith('d'),
          });
        });
      } else {
        // Fallback: note-by-note generation with a density limit on short notes
        // We will generate exactly 4 beats for this measure
        const durationPool: NoteDuration[] = [];
        if (enabledRhythms.whole) durationPool.push('w');
        if (enabledRhythms.half) durationPool.push('h');
        if (enabledRhythms.quarter) durationPool.push('q');
        if (enabledRhythms.eighth) durationPool.push('8');
        if (enabledRhythms.sixteenth) durationPool.push('16');
        
        if (enabledRhythms.dotted) {
          if (enabledRhythms.half) durationPool.push('hd'); // 3 beats
          if (enabledRhythms.quarter) durationPool.push('qd'); // 1.5 beats
          if (enabledRhythms.eighth) durationPool.push('8d'); // 0.75 beats
          if (enabledRhythms.sixteenth) durationPool.push('16d'); // 0.375 beats
        }

        // Fallback
        if (durationPool.length === 0) {
          durationPool.push('q');
        }

        let currentMeasureBeats = 0;
        let consecutiveShortNotes = 0;

        while (currentMeasureBeats < 4) {
          const remainingBeats = 4 - currentMeasureBeats;
          
          let validDurations = durationPool.filter((dur) => BEAT_MAP[dur] <= remainingBeats + 0.001);

          // Constrain density of short notes (eighth/sixteenth)
          if (consecutiveShortNotes >= 2) {
            const longDurations = validDurations.filter((dur) => BEAT_MAP[dur] >= 1.0);
            if (longDurations.length > 0) {
              validDurations = longDurations;
            }
          }

          if (validDurations.length === 0) {
            const possibleDurations: NoteDuration[] = ['16', '8', 'q', 'h', 'w'];
            const fitted = possibleDurations.find((dur) => BEAT_MAP[dur] <= remainingBeats + 0.001);
            validDurations = fitted ? [fitted] : ['16'];
          }

          const chosenDuration = validDurations[Math.floor(Math.random() * validDurations.length)];
          const durationBeats = BEAT_MAP[chosenDuration];

          if (chosenDuration === '8' || chosenDuration === '16' || chosenDuration === '8d' || chosenDuration === '16d') {
            consecutiveShortNotes++;
          } else {
            consecutiveShortNotes = 0;
          }

          // Determine if note or rest
          let isRest = false;
          if (currentMeasureBeats > 0 && enabledRhythms.rests && Math.random() < 0.15) {
            isRest = true;
          }

          let pitch = 'R';
          if (!isRest) {
            let nextPitch = '';
            let attempts = 0;
            let valid = false;
            
            let targetPool = currentMeasureBeats === 0 ? chordTonePool : (Math.random() < 0.6 ? chordTonePool : scaleTonePool);
            if (targetPool.length === 0) targetPool = scaleTonePool;

            while (!valid && attempts < 20) {
              const tempPitch = targetPool[Math.floor(Math.random() * targetPool.length)];
              if (!previousPitch) {
                valid = true;
                nextPitch = tempPitch;
                break;
              }

              const p1Name = previousPitch.replace(/\d+$/, '');
              const p1Oct = parseInt(previousPitch.match(/\d+$/)?.[0] || '4', 10);
              const p2Name = tempPitch.replace(/\d+$/, '');
              const p2Oct = parseInt(tempPitch.match(/\d+$/)?.[0] || '4', 10);

              const semitones1 = CHROMATIC_NOTES.indexOf(p1Name) + p1Oct * 12;
              const semitones2 = CHROMATIC_NOTES.indexOf(p2Name) + p2Oct * 12;
              const diff = Math.abs(semitones1 - semitones2);

              if (diff <= maxLeap) {
                nextPitch = tempPitch;
                valid = true;
              }
              attempts++;
            }

            if (!valid) {
              if (previousPitch) {
                const p1Name = previousPitch.replace(/\d+$/, '');
                const p1Oct = parseInt(previousPitch.match(/\d+$/)?.[0] || '4', 10);
                const semitones1 = CHROMATIC_NOTES.indexOf(p1Name) + p1Oct * 12;
                
                let closestPitch = targetPool[0];
                let minDiff = 999;
                targetPool.forEach((tempPitch) => {
                  const p2Name = tempPitch.replace(/\d+$/, '');
                  const p2Oct = parseInt(tempPitch.match(/\d+$/)?.[0] || '4', 10);
                  const semitones2 = CHROMATIC_NOTES.indexOf(p2Name) + p2Oct * 12;
                  const diff = Math.abs(semitones1 - semitones2);
                  if (diff < minDiff) {
                    minDiff = diff;
                    closestPitch = tempPitch;
                  }
                });
                nextPitch = closestPitch;
              } else {
                nextPitch = targetPool[0];
              }
            }

            pitch = nextPitch;
            previousPitch = nextPitch;
          }

          generatedNotes.push({
            pitch,
            duration: chosenDuration,
            type: isRest ? 'rest' : 'note',
            isDotted: chosenDuration.endsWith('d'),
          });

          currentMeasureBeats += durationBeats;
        }
      }
    });

    setNotes(generatedNotes);
    setCorrectSequence(generatedChords);
  };

  useEffect(() => {
    handleGenerate();
  }, [scaleRoot, scaleType, enabledRhythms, difficulty]);

  const handlePlayMelodyOnly = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setActiveNoteIndex(null);
      return;
    }

    setIsPlaying(true);
    audioEngine.setTempo(tempo);

    if (playbackMode === 'slow') {
      audioEngine.setPlaybackSpeed(0.5);
    } else {
      audioEngine.setPlaybackSpeed(1.0);
    }

    const isCallResp = playbackMode === 'call-and-response';
    const isAutoRep = playbackMode === 'auto-repeat';

    const triggerPlay = () => {
      audioEngine.playMelody(
        notes,
        (idx) => {
          setActiveNoteIndex(idx);
        },
        () => {
          if (isAutoRep) {
            triggerPlay();
          } else {
            setIsPlaying(false);
            setActiveNoteIndex(null);
          }
        },
        isCallResp
      );
    };

    triggerPlay();
  };

  const handlePlayWithChords = (useCorrectChords: boolean = false) => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setActiveNoteIndex(null);
      return;
    }

    // Map chords to pitches
    const rootIndex = CHROMATIC_NOTES.indexOf(scaleRoot);
    const measureChords: string[][] = [];

    for (let i = 0; i < 4; i++) {
      const chordIdx = useCorrectChords ? correctSequence[i]?.degreeIndex : userSelectedChords[i];
      if (chordIdx !== null && chordIdx !== undefined) {
        const chordDef = diatonicChords[chordIdx];
        const chordPitches = chordDef.intervals.map((semitones) => {
          const midiVal = 12 * (3 + 1) + rootIndex + chordDef.semitoneOffset + semitones;
          const l = CHROMATIC_NOTES[midiVal % 12];
          const o = Math.floor(midiVal / 12) - 1;
          return `${l}${o}`;
        });
        measureChords.push(chordPitches);
      } else {
        measureChords.push([]); // silent measure
      }
    }

    setIsPlaying(true);
    audioEngine.setTempo(tempo);

    if (playbackMode === 'slow') {
      audioEngine.setPlaybackSpeed(0.5);
    } else {
      audioEngine.setPlaybackSpeed(1.0);
    }

    audioEngine.playMelodyWithChords(
      notes,
      measureChords,
      4, // 4 beats per bar
      (idx) => {
        setActiveNoteIndex(idx);
      },
      () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
      }
    );
  };

  const handleSelectChord = (chordIndex: number) => {
    if (isAnswered) return;
    setUserSelectedChords((prev) => {
      const updated = [...prev];
      updated[activeSlot] = chordIndex;
      return updated;
    });

    // Auto-advance slot
    if (activeSlot < 3) {
      setActiveSlot(activeSlot + 1);
    }
  };

  const getDownbeatNoteForMeasure = (measureIdx: number): string => {
    if (notes.length === 0) return '';
    // Find note at beginning of measure
    let currentBeat = 0;
    const targetBeat = measureIdx * 4;
    for (let i = 0; i < notes.length; i++) {
      if (Math.abs(currentBeat - targetBeat) < 0.01) {
        return notes[i].pitch.replace(/\d+$/, '');
      }
      currentBeat += getBeatDuration(notes[i].duration);
    }
    return '';
  };

  const getBeatDuration = (dur: string): number => {
    if (dur === 'w') return 4;
    if (dur === 'h') return 2;
    if (dur === 'q') return 1;
    if (dur === '8') return 0.5;
    return 1;
  };

  const handleSubmit = () => {
    if (userSelectedChords.some((c) => c === null)) return;

    const results = userSelectedChords.map((selected, idx) => {
      return selected === correctSequence[idx]?.degreeIndex;
    });

    setMatchingResults(results);
    const correctCount = results.filter((r) => r).length;
    const accuracy = Math.round((correctCount / 4) * 100);
    setQuizAccuracy(accuracy);
    setIsAnswered(true);

    const elapsed = parseFloat(((Date.now() - questionStartTime) / 1000).toFixed(1));

    setSessionHistory((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        questionLabel: `Melody Harmonization in ${scaleRoot} ${scaleType}`,
        isCorrect: accuracy === 100,
        timeTakenSec: elapsed,
      },
    ]);

    onAddScore(accuracy, elapsed, correctCount, 4);
  };

  // Helper to explain the harmonization
  const getHarmonizationExplanation = (measureIdx: number): string => {
    const correctChord = correctSequence[measureIdx];
    if (!correctChord) return '';

    const firstNote = getDownbeatNoteForMeasure(measureIdx);
    const chordDef = diatonicChords[correctChord.degreeIndex];

    const noteLetter = firstNote;
    const chordRootIdx = CHROMATIC_NOTES.indexOf(scaleRoot) + chordDef.semitoneOffset;
    const chordRootLetter = CHROMATIC_NOTES[chordRootIdx % 12];

    const noteIdx = CHROMATIC_NOTES.indexOf(noteLetter);
    const rootIdx = CHROMATIC_NOTES.indexOf(chordRootLetter);

    let relation = 'chord tone';
    if (noteIdx !== -1 && rootIdx !== -1) {
      const diff = (noteIdx - rootIdx + 12) % 12;
      if (diff === 0) relation = 'root (fundamental)';
      else if (diff === 3 || diff === 4) relation = 'third (color tone)';
      else if (diff === 7) relation = 'fifth (stable foundation)';
    }

    return `Measure ${measureIdx + 1} begins on the strong downbeat note "${noteLetter}". In the key of ${scaleRoot} ${scaleType}, the most fitting harmonization is ${correctChord.name} because "${noteLetter}" serves as the ${relation} of the chord, forming a highly pleasing consonance.`;
  };

  return (
    <div className="space-y-6">
      {/* Settings Row */}
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span>🎼</span> Harmonization Configurator
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Root Note</label>
            <div className="grid grid-cols-6 gap-1">
              {CHROMATIC_NOTES.map((note) => (
                <button
                  key={note}
                  onClick={() => setScaleRoot(note)}
                  className={`py-1 rounded-lg text-xs font-bold border transition-all ${
                    scaleRoot === note
                      ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Type</label>
            <div className="flex gap-2">
              {['Major', 'Natural Minor'].map((type) => (
                <button
                  key={type}
                  onClick={() => setScaleType(type as any)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    scaleType === type
                      ? 'bg-accent-500/10 border-accent-400 text-accent-600 dark:text-accent-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-350'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Tempo: {tempo} BPM</label>
            <input
              type="range"
              min="60"
              max="150"
              step="10"
              value={tempo}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setTempo(val);
                audioEngine.setTempo(val);
              }}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-music-600 mt-2"
            />
            <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
              <span>60 BPM</span>
              <span>150 BPM</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Instrument</label>
            <select
              value={instrument}
              onChange={(e) => setInstrument(e.target.value as InstrumentType)}
              className="w-full glass-input text-xs font-bold h-9"
            >
              <option value="piano">Piano (Keyboard)</option>
              <option value="guitar">Nylon Guitar</option>
              <option value="violin">Sustain Violin</option>
              <option value="flute">Flute</option>
              <option value="synth">Synthesizer</option>
            </select>
          </div>
        </div>

        {/* Playback Mode, Difficulty, and Rhythm Patterns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-slate-200/50 dark:border-slate-800/50">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Playback Mode</label>
            <select
              value={playbackMode}
              onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
              className="w-full glass-input text-xs font-bold h-9"
            >
              <option value="manual">Manual Play</option>
              <option value="auto-repeat">Auto Repeat</option>
              <option value="slow">Slow Practice (50%)</option>
              <option value="call-and-response">Call & Response</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Difficulty (Intervals)</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full glass-input text-xs font-bold h-9"
            >
              <option value="beginner">Beginner (Stepwise)</option>
              <option value="intermediate">Intermediate (Small Leaps)</option>
              <option value="advanced">Advanced (Large Leaps)</option>
              <option value="expert">Expert (Any Interval)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-500 mb-2">Rhythm Patterns</label>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-1.5">
              {Object.keys(enabledRhythms).map((key) => {
                const isChecked = enabledRhythms[key];
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setEnabledRhythms((prev) => ({
                        ...prev,
                        [key]: !prev[key],
                      }));
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border capitalize transition-all ${
                      isChecked
                        ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-350'
                    }`}
                  >
                    {key.replace(/([A-Z])/g, ' $1')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet Music Rendering */}
      <div className="glass-card rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🎼</span> Harmonize this Melody
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Select the appropriate diatonic chord for each of the 4 measures.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePlayMelodyOnly}
              className={`glass-button-secondary gap-1.5 text-xs py-2 px-3 h-10 rounded-xl ${
                isPlaying ? 'border-red-500 text-red-500' : ''
              }`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              Melody Only
            </button>

            <button
              onClick={() => handlePlayWithChords(false)}
              className="glass-button-primary gap-1.5 text-xs py-2 px-4 h-10 rounded-xl"
            >
              <Volume2 className="w-4 h-4" />
              Play with My Chords
            </button>

            <button
              onClick={handleGenerate}
              className="glass-button-secondary w-10 h-10 rounded-full !p-0"
              title="Generate New Melody"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <SheetMusic notes={notes} timeSignature="4/4" activeNoteIndex={activeNoteIndex} />
      </div>

      {/* Harmonization Workspace */}
      <div className="glass-card rounded-3xl p-6 space-y-6">
        <div>
          <h3 className="font-display font-bold text-lg mb-1">Harmonization Workspace</h3>
          <p className="text-xs text-slate-500">Click a measure slot, then select its chord accompaniment below.</p>
        </div>

        {/* 4 Measure Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => {
            const isSelected = activeSlot === idx;
            const isMatch = matchingResults[idx];
            const userChordIdx = userSelectedChords[idx];
            const correctChord = correctSequence[idx];

            let cardStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-850 dark:text-slate-100 hover:border-music-400';
            if (isSelected) {
              cardStyle = 'border-music-500 ring-2 ring-music-500/20 bg-music-500/5 text-music-600 dark:text-music-400 font-bold';
            }
            if (isAnswered) {
              cardStyle = isMatch
                ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 font-bold'
                : 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 font-bold';
            }

            return (
              <button
                key={idx}
                onClick={() => !isAnswered && setActiveSlot(idx)}
                className={`p-4 rounded-2xl border text-center transition-all flex flex-col justify-center items-center gap-1.5 min-h-[96px] ${cardStyle}`}
              >
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Measure {idx + 1}</span>
                <span className="text-xs text-slate-500 font-semibold font-mono">
                  Downbeat Note: {getDownbeatNoteForMeasure(idx) || '?'}
                </span>
                <span className="text-sm font-bold mt-1">
                  {userChordIdx !== null ? `${scaleRoot} ${diatonicChords[userChordIdx].roman}` : '?'}
                </span>
                {isAnswered && !isMatch && correctChord && (
                  <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-red-200/40 w-full block">
                    Correct: {correctChord.roman}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Chord Selection Pad */}
        {!isAnswered && (
          <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/60 space-y-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Select Accompanying Chord for Measure {activeSlot + 1}
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {diatonicChords.map((chord, index) => {
                const rootIdx = (CHROMATIC_NOTES.indexOf(scaleRoot) + chord.semitoneOffset) % 12;
                const letter = CHROMATIC_NOTES[rootIdx];
                return (
                  <button
                    key={index}
                    onClick={() => handleSelectChord(index)}
                    className="py-3 px-1 rounded-xl text-xs font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-music-400 hover:scale-103 active:scale-97 transition-all flex flex-col items-center gap-0.5"
                  >
                    <span className="font-mono text-music-600 dark:text-music-400 text-sm">{chord.roman}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{letter} {chord.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2.5">
          {!isAnswered && (
            <button
              onClick={() => setUserSelectedChords([null, null, null, null])}
              disabled={userSelectedChords.every((c) => c === null)}
              className="glass-button-secondary h-11 px-4 text-xs font-bold"
            >
              Clear All
            </button>
          )}

          <button
            onClick={handleSubmit}
            disabled={isAnswered || userSelectedChords.some((c) => c === null)}
            className="glass-button-primary h-11 flex-1 text-xs font-bold"
          >
            {isAnswered ? 'Quiz Completed' : 'Submit Harmonization'}
          </button>
        </div>

        {/* Feedback Panel */}
        {isAnswered && quizAccuracy !== null && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {quizAccuracy === 100 ? (
                  <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {quizAccuracy === 100 ? 'Perfect Ear! Clean Harmonization.' : `Completed with ${quizAccuracy}% accuracy`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                    Progression: {correctSequence.map((c) => c.roman).join(' ➜ ')} (in {scaleRoot} {scaleType})
                  </p>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                <button
                  onClick={() => handlePlayWithChords(true)}
                  className="flex-1 md:flex-none glass-button-secondary h-10 px-4 text-xs font-bold gap-1.5"
                >
                  <Volume2 className="w-4 h-4" />
                  Listen to Correct Play
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-1 md:flex-none glass-button-primary h-10 px-5 text-xs font-bold shadow-md shadow-music-500/10"
                >
                  Next Melody
                </button>
              </div>
            </div>

            {/* Harmony Analysis explanation */}
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs space-y-3">
              <span className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block font-display">
                Harmonic Analysis & Explanations
              </span>
              <div className="space-y-2.5 text-slate-600 dark:text-slate-400">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <p key={idx} className="leading-relaxed">
                    📝 {getHarmonizationExplanation(idx)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Practice Session Report */}
      {sessionHistory.length > 0 && (
        <div className="glass-card rounded-3xl p-6">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <span>📊</span> Practice Session Report
              </h3>
              <p className="text-xs text-slate-500">Real-time statistics for your current practice run.</p>
            </div>
            <button
              onClick={() => setSessionHistory([])}
              className="text-xs font-semibold text-slate-400 hover:text-red-500 font-bold"
            >
              Reset Session
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50/50 dark:bg-slate-900/35 border border-slate-150/20 dark:border-slate-800 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Accuracy</span>
              <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                {Math.round(
                  (sessionHistory.filter((h) => h.isCorrect).length / sessionHistory.length) * 100
                )}%
              </span>
              <span className="text-[10px] text-slate-450 block mt-0.5">
                ({sessionHistory.filter((h) => h.isCorrect).length} / {sessionHistory.length} correct)
              </span>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-900/35 border border-slate-150/20 dark:border-slate-800 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Avg Time</span>
              <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                {(
                  sessionHistory.reduce((sum, h) => sum + h.timeTakenSec, 0) /
                  sessionHistory.length
                ).toFixed(1)}s
              </span>
              <span className="text-[10px] text-slate-450 block mt-0.5">per melody</span>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-900/35 border border-slate-150/20 dark:border-slate-800 p-3.5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Total Time</span>
              <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                {sessionHistory.reduce((sum, h) => sum + h.timeTakenSec, 0).toFixed(0)}s
              </span>
              <span className="text-[10px] text-slate-450 block mt-0.5">spent active</span>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {sessionHistory.slice().reverse().map((item, idx) => (
              <div
                key={item.id}
                className="flex justify-between items-center py-2.5 px-4 rounded-xl border border-slate-100 dark:border-slate-850/60 bg-white/30 dark:bg-slate-950/20 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-slate-400">#{item.id}</span>
                  <span className="font-semibold text-slate-755 dark:text-slate-345">{item.questionLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-400">{item.timeTakenSec}s</span>
                  {item.isCorrect ? (
                    <span className="bg-green-500/10 text-green-700 dark:text-green-400 py-0.5 px-2 rounded-full font-bold text-[10px]">
                      Correct
                    </span>
                  ) : (
                    <span className="bg-red-500/10 text-red-700 dark:text-red-400 py-0.5 px-2 rounded-full font-bold text-[10px]">
                      Incorrect
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HarmonizationTrainer;
