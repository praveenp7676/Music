import React, { useState, useEffect } from 'react';
import { audioEngine } from '../utils/AudioEngine';
import { Volume2, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

interface ChordTrainerProps {
  onAddScore: (accuracy: number, timeTakenSec?: number) => void;
}

interface SessionHistoryItem {
  id: number;
  questionLabel: string;
  isCorrect: boolean;
  timeTakenSec: number;
}

interface ChordDef {
  name: string;
  intervals: number[]; // relative semitones from root
  type: 'triad' | 'seventh';
}

const CHORDS: ChordDef[] = [
  // Triads
  { name: 'Major Triad', intervals: [0, 4, 7], type: 'triad' },
  { name: 'Minor Triad', intervals: [0, 3, 7], type: 'triad' },
  { name: 'Diminished Triad', intervals: [0, 3, 6], type: 'triad' },
  { name: 'Augmented Triad', intervals: [0, 4, 8], type: 'triad' },
  // Sevenths
  { name: 'Major 7th (Maj7)', intervals: [0, 4, 7, 11], type: 'seventh' },
  { name: 'Minor 7th (Min7)', intervals: [0, 3, 7, 10], type: 'seventh' },
  { name: 'Dominant 7th (Dom7)', intervals: [0, 4, 7, 10], type: 'seventh' },
  { name: 'Half-Diminished 7th (ø7)', intervals: [0, 3, 6, 10], type: 'seventh' },
];

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const OCTAVE_RANGES = [
  { label: 'Oct 2', value: '2', octaves: [2] },
  { label: 'Oct 3', value: '3', octaves: [3] },
  { label: 'Oct 4', value: '4', octaves: [4] },
  { label: 'Oct 5', value: '5', octaves: [5] },
  { label: 'Oct 2 - 3', value: '2-3', octaves: [2, 3] },
  { label: 'Oct 3 - 4', value: '3-4', octaves: [3, 4] },
  { label: 'Oct 4 - 5', value: '4-5', octaves: [4, 5] },
  { label: 'Oct 2 - 5', value: '2-5', octaves: [2, 3, 4, 5] },
];

// Diatonic Chord Degrees in Major Scale
const MAJOR_DIATONIC_DEGREES = [
  { degreeName: 'I (Major)', semitoneOffset: 0, chordName: 'Major Triad', intervals: [0, 4, 7] },
  { degreeName: 'ii (Minor)', semitoneOffset: 2, chordName: 'Minor Triad', intervals: [0, 3, 7] },
  { degreeName: 'iii (Minor)', semitoneOffset: 4, chordName: 'Minor Triad', intervals: [0, 3, 7] },
  { degreeName: 'IV (Major)', semitoneOffset: 5, chordName: 'Major Triad', intervals: [0, 4, 7] },
  { degreeName: 'V (Major)', semitoneOffset: 7, chordName: 'Major Triad', intervals: [0, 4, 7] },
  { degreeName: 'vi (Minor)', semitoneOffset: 9, chordName: 'Minor Triad', intervals: [0, 3, 7] },
];

// Diatonic Chord Degrees in Natural Minor Scale (3 Major and 3 Minor)
const MINOR_DIATONIC_DEGREES = [
  { degreeName: 'i (Minor)', semitoneOffset: 0, chordName: 'Minor Triad', intervals: [0, 3, 7] },
  { degreeName: 'III (Major)', semitoneOffset: 3, chordName: 'Major Triad', intervals: [0, 4, 7] },
  { degreeName: 'iv (Minor)', semitoneOffset: 5, chordName: 'Minor Triad', intervals: [0, 3, 7] },
  { degreeName: 'v (Minor)', semitoneOffset: 7, chordName: 'Minor Triad', intervals: [0, 3, 7] },
  { degreeName: 'VI (Major)', semitoneOffset: 8, chordName: 'Major Triad', intervals: [0, 4, 7] },
  { degreeName: 'VII (Major)', semitoneOffset: 10, chordName: 'Major Triad', intervals: [0, 4, 7] },
];

export const ChordTrainer: React.FC<ChordTrainerProps> = ({ onAddScore }) => {
  // Modes Configurations
  const [complexity, setComplexity] = useState<'basic' | 'advanced'>('basic'); 
  const [mode, setMode] = useState<'random' | 'scale'>('random'); 
  const [playbackStyle, setPlaybackStyle] = useState<'block' | 'arpeggiated'>('arpeggiated');
  
  // Selected Octave Range (value maps to OCTAVE_RANGES)
  const [octaveRange, setOctaveRange] = useState<string>('3-4');
  
  // Diatonic scale configuration (split root and type)
  const [scaleRoot, setScaleRoot] = useState('C');
  const [scaleType, setScaleType] = useState<'Major' | 'Natural Minor'>('Major');

  // Quiz States
  const [chordLabel, setChordLabel] = useState(''); 
  const [chordPitches, setChordPitches] = useState<string[]>([]);
  const [correctAnswer, setCorrectAnswer] = useState(''); 
  const [options, setOptions] = useState<string[]>([]);
  const [activeOctavePlayed, setActiveOctavePlayed] = useState<number>(4);
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [scoreStats, setScoreStats] = useState({ correct: 0, total: 0 });

  // Time tracking and session stats
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const getEnabledOctaves = (rangeVal: string): number[] => {
    const found = OCTAVE_RANGES.find((r) => r.value === rangeVal);
    return found ? found.octaves : [3, 4];
  };

  const generateQuestion = () => {
    audioEngine.stop();
    setSelectedOption(null);
    setIsAnswered(false);
    setQuestionStartTime(Date.now());

    const octs = getEnabledOctaves(octaveRange);
    // Pick random octave from enabled ones
    const octaveVal = octs[Math.floor(Math.random() * octs.length)] || 4;
    setActiveOctavePlayed(octaveVal);

    if (mode === 'scale') {
      // Scale-Based Quiz (Diatonic Degrees)
      const scaleRootIndex = CHROMATIC_NOTES.indexOf(scaleRoot);
      const diatonicList = scaleType === 'Major' ? MAJOR_DIATONIC_DEGREES : MINOR_DIATONIC_DEGREES;

      // Pick random scale degree (0 to 5)
      const randomDegreeIdx = Math.floor(Math.random() * 6);
      const degreeDef = diatonicList[randomDegreeIdx];

      // Calculate absolute chord root note based on selected octave
      const chordRootMidi = 12 * (octaveVal + 1) + scaleRootIndex + degreeDef.semitoneOffset;
      const rootOctave = Math.floor(chordRootMidi / 12) - 1;
      const rootLetter = CHROMATIC_NOTES[chordRootMidi % 12];

      // Calculate pitches relative to selected octave
      const pitches = degreeDef.intervals.map((semitones) => {
        const noteMidi = chordRootMidi + semitones;
        const octave = Math.floor(noteMidi / 12) - 1;
        const letter = CHROMATIC_NOTES[noteMidi % 12];
        return `${letter}${octave}`;
      });
      setChordPitches(pitches);
      
      const correctText = `${degreeDef.degreeName} - ${rootLetter} ${degreeDef.chordName.split(' ')[0]}`;
      setCorrectAnswer(correctText);

      // Options: All 6 diatonic degrees in this scale
      const allDiatonicOptions = diatonicList.map((d) => {
        const rootM = 12 * (octaveVal + 1) + scaleRootIndex + d.semitoneOffset;
        const letter = CHROMATIC_NOTES[rootM % 12];
        return `${d.degreeName} - ${letter} ${d.chordName.split(' ')[0]}`;
      });
      setOptions(allDiatonicOptions);
      setChordLabel(correctText);

    } else {
      // Random Roots Quiz
      const rootIndex = Math.floor(Math.random() * 12);
      const rootLetter = CHROMATIC_NOTES[rootIndex];

      // Filter chords based on complexity
      const allowedChords = CHORDS.filter((c) => {
        if (complexity === 'basic') {
          return c.name === 'Major Triad' || c.name === 'Minor Triad';
        }
        return true;
      });

      const chord = allowedChords[Math.floor(Math.random() * allowedChords.length)];

      const pitches = chord.intervals.map((semitones) => {
        const targetMidi = 12 * (octaveVal + 1) + rootIndex + semitones;
        const octave = Math.floor(targetMidi / 12) - 1;
        const noteName = CHROMATIC_NOTES[targetMidi % 12];
        return `${noteName}${octave}`;
      });
      setChordPitches(pitches);

      const label = `${rootLetter} ${chord.name}`;
      setChordLabel(label);
      setCorrectAnswer(chord.name);

      // Distractors
      const distractors = allowedChords
        .filter((c) => c.name !== chord.name)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map((c) => c.name);

      const finalOptions = [chord.name, ...distractors].sort(() => 0.5 - Math.random());
      setOptions(finalOptions);
    }
  };

  useEffect(() => {
    generateQuestion();
  }, [complexity, mode, scaleRoot, scaleType, octaveRange]);

  const playChordSound = async () => {
    audioEngine.stop();

    if (playbackStyle === 'block') {
      await audioEngine.playChord(chordPitches, 'h');
    } else {
      chordPitches.forEach((pitch, idx) => {
        setTimeout(() => {
          audioEngine.playNote(pitch, '8');
        }, idx * 250);
      });

      setTimeout(() => {
        audioEngine.playChord(chordPitches, 'q');
      }, chordPitches.length * 250 + 100);
    }
  };

  useEffect(() => {
    let timer: any;
    if (chordPitches.length > 0) {
      timer = setTimeout(() => {
        playChordSound();
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [chordPitches, playbackStyle]);

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;

    setSelectedOption(option);
    const correct = option === correctAnswer;
    setIsCorrect(correct);
    setIsAnswered(true);
    setScoreStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    const elapsed = parseFloat(((Date.now() - questionStartTime) / 1000).toFixed(1));

    const questionLabel = mode === 'scale'
      ? `${scaleRoot} ${scaleType} Degree Chord (${chordLabel.split(' - ')[0]})`
      : `${chordLabel}`;

    setSessionHistory((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        questionLabel: questionLabel,
        isCorrect: correct,
        timeTakenSec: elapsed,
      },
    ]);

    onAddScore(correct ? 100 : 0, elapsed);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Controls settings block */}
      <div className="glass-card rounded-3xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Complexity Level</label>
            <div className="flex gap-1.5">
              {(['basic', 'advanced'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setComplexity(level)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                    complexity === level
                      ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {level === 'basic' ? 'Basic (Maj/Min)' : 'Advanced'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Root Note Mode</label>
            <div className="flex gap-1.5">
              {(['random', 'scale'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize border transition-all ${
                    mode === m
                      ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                }`}
              >
                {m === 'random' ? 'Random Key' : 'Scale-Based'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2">Chord Octave Range</label>
          <select
            value={octaveRange}
            onChange={(e) => setOctaveRange(e.target.value)}
            className="w-full glass-input text-xs font-bold"
          >
            {OCTAVE_RANGES.map((r) => (
              <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === 'scale' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200/50 dark:border-slate-800/50 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Root Note</label>
            <div className="grid grid-cols-6 gap-1.5">
              {CHROMATIC_NOTES.map((note) => (
                <button
                  key={note}
                  onClick={() => setScaleRoot(note)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    scaleRoot === note
                      ? 'bg-accent-500/15 border-accent-400 text-accent-600 dark:text-accent-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Type</label>
            <div className="flex gap-1.5">
              {(['Major', 'Natural Minor'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setScaleType(type)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                    scaleType === type
                      ? 'bg-accent-500/15 border-accent-400 text-accent-600 dark:text-accent-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2.5">
              Quizzes are arranged using the 3 Major and 3 Minor diatonic chords in {scaleRoot} {scaleType}.
            </p>
          </div>
        </div>
      )}
    </div>

    <div className="glass-card rounded-3xl p-6 relative overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span>🎹</span> Chord Recognition
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'scale' 
              ? `Identify diatonic degree chords in ${scaleRoot} ${scaleType} (Octaves: ${getEnabledOctaves(octaveRange).join(', ')}).` 
              : `Identify the triad/seventh chord type played (Octaves: ${getEnabledOctaves(octaveRange).join(', ')}).`}
          </p>
        </div>
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2 text-right">
          <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Score</span>
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
            {scoreStats.correct} / {scoreStats.total}
          </span>
        </div>
      </div>

      {/* Playback style selection */}
      <div className="flex justify-center gap-2 mb-6">
        {(['arpeggiated', 'block'] as const).map((style) => (
          <button
            key={style}
            onClick={() => setPlaybackStyle(style)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
              playbackStyle === style
                ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-500'
            }`}
          >
            {style === 'block' ? 'Solid Block' : 'Arpeggiated (Broken)'}
          </button>
        ))}
      </div>

      {/* Central Play Ring */}
      <div className="flex flex-col items-center justify-center py-6">
        <button
          onClick={playChordSound}
          className="w-24 h-24 rounded-full bg-gradient-to-tr from-music-600 to-accent-600 hover:from-music-500 hover:to-accent-500 text-white flex items-center justify-center shadow-lg shadow-music-500/25 active:scale-95 transition-all mb-4"
        >
          <Volume2 className="w-8 h-8" />
        </button>
        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
          Click to play chord sound (Octave {activeOctavePlayed})
        </span>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {options.map((option) => {
          const isSelected = selectedOption === option;
          let btnStyle = 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850';
          
          if (isAnswered) {
            if (option === correctAnswer) {
              btnStyle = 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300 font-bold';
            } else if (isSelected) {
              btnStyle = 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 font-bold';
            } else {
              btnStyle = 'border-slate-100 dark:border-slate-900 opacity-50';
            }
          } else if (isSelected) {
            btnStyle = 'border-music-500 bg-music-500/5 text-music-600';
          }

          return (
            <button
              key={option}
              onClick={() => handleOptionSelect(option)}
              disabled={isAnswered}
              className={`py-4 px-2 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${btnStyle}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {/* Feedback Panel */}
      {isAnswered && (
        <div className="mt-6 p-4 rounded-2xl flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50">
          <div className="flex items-center gap-3">
            {isCorrect ? (
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            ) : (
              <XCircle className="w-8 h-8 text-red-500" />
            )}
            <div>
              <p className="font-bold text-sm">
                {isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                The correct answer was <span className="font-semibold text-slate-700 dark:text-slate-300">{correctAnswer}</span>.
              </p>
            </div>
          </div>
          <button
            onClick={generateQuestion}
            className="glass-button-secondary gap-1.5 text-xs py-2 px-3 h-10 rounded-xl"
          >
            Next <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        )}
      </div>

      {/* Session Report Section */}
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
              className="text-xs font-semibold text-slate-400 hover:text-red-500"
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
              <span className="text-[10px] text-slate-450 block mt-0.5">per question</span>
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
export default ChordTrainer;
