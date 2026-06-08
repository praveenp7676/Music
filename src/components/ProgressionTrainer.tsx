import React, { useState, useEffect } from 'react';
import { audioEngine } from '../utils/AudioEngine';
import { Play, Square, RefreshCw, Volume2, ArrowRight, Delete, X, CheckCircle2, XCircle } from 'lucide-react';

interface ProgressionTrainerProps {
  onAddScore: (accuracy: number, timeTakenSec?: number, subCorrect?: number, subTotal?: number) => void;
}

interface SessionHistoryItem {
  id: number;
  questionLabel: string;
  isCorrect: boolean;
  timeTakenSec: number;
}

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

interface DiatonicChord {
  degreeName: string; // e.g. "I (Major)"
  semitoneOffset: number;
  chordType: 'Major' | 'Minor';
  intervals: number[];
}

const MAJOR_DIATONIC: DiatonicChord[] = [
  { degreeName: 'I (Major)', semitoneOffset: 0, chordType: 'Major', intervals: [0, 4, 7] },
  { degreeName: 'ii (Minor)', semitoneOffset: 2, chordType: 'Minor', intervals: [0, 3, 7] },
  { degreeName: 'iii (Minor)', semitoneOffset: 4, chordType: 'Minor', intervals: [0, 3, 7] },
  { degreeName: 'IV (Major)', semitoneOffset: 5, chordType: 'Major', intervals: [0, 4, 7] },
  { degreeName: 'V (Major)', semitoneOffset: 7, chordType: 'Major', intervals: [0, 4, 7] },
  { degreeName: 'vi (Minor)', semitoneOffset: 9, chordType: 'Minor', intervals: [0, 3, 7] },
];

const MINOR_DIATONIC: DiatonicChord[] = [
  { degreeName: 'i (Minor)', semitoneOffset: 0, chordType: 'Minor', intervals: [0, 3, 7] },
  { degreeName: 'III (Major)', semitoneOffset: 3, chordType: 'Major', intervals: [0, 4, 7] },
  { degreeName: 'iv (Minor)', semitoneOffset: 5, chordType: 'Minor', intervals: [0, 3, 7] },
  { degreeName: 'v (Minor)', semitoneOffset: 7, chordType: 'Minor', intervals: [0, 3, 7] },
  { degreeName: 'VI (Major)', semitoneOffset: 8, chordType: 'Major', intervals: [0, 4, 7] },
  { degreeName: 'VII (Major)', semitoneOffset: 10, chordType: 'Major', intervals: [0, 4, 7] },
];

export const ProgressionTrainer: React.FC<ProgressionTrainerProps> = ({ onAddScore }) => {
  // Scale Configurations
  const [scaleRoot, setScaleRoot] = useState('C');
  const [scaleType, setScaleType] = useState<'Major' | 'Natural Minor'>('Major');
  const [enabledDegrees, setEnabledDegrees] = useState<number[]>([0, 1, 3, 4, 5]); // Default I, ii, IV, V, vi
  
  // Playback configurations
  const [sequenceLength, setSequenceLength] = useState<number>(4);
  const [playbackStyle, setPlaybackStyle] = useState<'block' | 'arpeggiated'>('block');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activePlayIdx, setActivePlayIdx] = useState<number | null>(null);

  // Octave range settings
  const [octaveRange, setOctaveRange] = useState<string>('3-4');

  // Quiz progression state
  const [correctSequence, setCorrectSequence] = useState<Array<{ name: string; pitches: string[]; correctNotes: string[]; octave: number }>>([]);
  const [userSpelledNotes, setUserSpelledNotes] = useState<string[][]>(() => Array.from({ length: 4 }, () => []));
  const [activeSlot, setActiveSlot] = useState<number>(0);
  
  // Results
  const [isAnswered, setIsAnswered] = useState(false);
  const [matchingResults, setMatchingResults] = useState<boolean[]>([]); // true for match, false for miss
  const [scoreStats, setScoreStats] = useState({ correct: 0, total: 0 });

  // Time tracking and session stats
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  const activeDiatonicList = scaleType === 'Major' ? MAJOR_DIATONIC : MINOR_DIATONIC;

  const getEnabledOctaves = (rangeVal: string): number[] => {
    const found = OCTAVE_RANGES.find((r) => r.value === rangeVal);
    return found ? found.octaves : [3, 4];
  };

  const getChordPitchesForOctave = (d: DiatonicChord, octaveVal: number): string[] => {
    const scaleRootIndex = CHROMATIC_NOTES.indexOf(scaleRoot);
    const chordRootMidi = 12 * (octaveVal + 1) + scaleRootIndex + d.semitoneOffset;
    return d.intervals.map((semitones) => {
      const noteMidi = chordRootMidi + semitones;
      const octave = Math.floor(noteMidi / 12) - 1;
      const letter = CHROMATIC_NOTES[noteMidi % 12];
      return `${letter}${octave}`;
    });
  };

  const handleDegreeToggle = (idx: number) => {
    if (enabledDegrees.includes(idx)) {
      if (enabledDegrees.length > 2) {
        setEnabledDegrees(enabledDegrees.filter((d) => d !== idx));
      }
    } else {
      setEnabledDegrees([...enabledDegrees, idx].sort());
    }
  };

  const generateSequence = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setActivePlayIdx(null);
    setUserSpelledNotes(Array.from({ length: sequenceLength }, () => []));
    setIsAnswered(false);
    setActiveSlot(0);
    setQuestionStartTime(Date.now());

    const octs = getEnabledOctaves(octaveRange);

    const generated: Array<{ name: string; pitches: string[]; correctNotes: string[]; octave: number }> = [];
    for (let i = 0; i < sequenceLength; i++) {
      const randomDegreeIdx = enabledDegrees[Math.floor(Math.random() * enabledDegrees.length)];
      const d = activeDiatonicList[randomDegreeIdx];
      const octaveVal = octs[Math.floor(Math.random() * octs.length)] || 4;
      
      const pitches = getChordPitchesForOctave(d, octaveVal);
      const correctNotes = pitches.map(p => p.replace(/\d+/g, ''));
      
      const scaleRootIndex = CHROMATIC_NOTES.indexOf(scaleRoot);
      const chordRootMidi = 12 * (octaveVal + 1) + scaleRootIndex + d.semitoneOffset;
      const rootLetter = CHROMATIC_NOTES[chordRootMidi % 12];

      generated.push({
        name: `${d.degreeName.split(' ')[0]} - ${rootLetter} ${d.chordType}`,
        pitches,
        correctNotes,
        octave: octaveVal,
      });
    }
    setCorrectSequence(generated);
  };

  useEffect(() => {
    generateSequence();
  }, [scaleRoot, scaleType, enabledDegrees, sequenceLength, octaveRange]);

  const playSequence = async () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setActivePlayIdx(null);
      return;
    }

    setIsPlaying(true);
    audioEngine.setTempo(80); // slow progression pacing
    audioEngine.setInstrument('piano');

    // Play chord sequence with timeouts
    for (let i = 0; i < correctSequence.length; i++) {
      if (!isPlaying) {
        // Double check playing state during iteration
      }
      setActivePlayIdx(i);
      const chord = correctSequence[i];
      
      // Play chord
      if (playbackStyle === 'block') {
        audioEngine.playChord(chord.pitches, 'h');
      } else {
        // Arpeggiate
        chord.pitches.forEach((p, pidx) => {
          setTimeout(() => {
            audioEngine.playNote(p, '8');
          }, pidx * 150);
        });
        setTimeout(() => {
          audioEngine.playChord(chord.pitches, 'q');
        }, chord.pitches.length * 150 + 50);
      }

      // Wait 1.8 seconds per chord block before playing the next
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }

    setIsPlaying(false);
    setActivePlayIdx(null);
  };

  const handleToggleNoteForActiveSlot = (note: string) => {
    if (isAnswered) return;
    setUserSpelledNotes((prev) => {
      const updated = [...prev];
      const currentNotes = updated[activeSlot] || [];
      if (currentNotes.includes(note)) {
        updated[activeSlot] = currentNotes.filter((n) => n !== note);
      } else {
        updated[activeSlot] = [...currentNotes, note].sort();
      }
      return updated;
    });
  };

  const handleClearActiveSlot = () => {
    if (isAnswered) return;
    setUserSpelledNotes((prev) => {
      const updated = [...prev];
      updated[activeSlot] = [];
      return updated;
    });
  };

  const handleClearAllSlots = () => {
    if (isAnswered) return;
    setUserSpelledNotes(Array.from({ length: sequenceLength }, () => []));
  };

  const isMatch = (userNotes: string[], correctNotes: string[]) => {
    if (userNotes.length !== correctNotes.length) return false;
    const userSorted = [...userNotes].map(n => n.toUpperCase()).sort();
    const correctSorted = [...correctNotes].map(n => n.toUpperCase()).sort();
    return userSorted.every((n, i) => n === correctSorted[i]);
  };

  const handleSubmitGuess = () => {
    if (userSpelledNotes.some(notes => notes.length === 0)) return;

    // Check match at each index position
    const results = userSpelledNotes.map((userNotes, idx) => {
      const correctNotes = correctSequence[idx].correctNotes;
      return isMatch(userNotes, correctNotes);
    });
    setMatchingResults(results);
    setIsAnswered(true);

    const matchesCount = results.filter((r) => r).length;
    const accuracy = Math.round((matchesCount / sequenceLength) * 100);

    setScoreStats((prev) => ({
      correct: prev.correct + (accuracy === 100 ? 1 : 0),
      total: prev.total + 1,
    }));

    const elapsed = parseFloat(((Date.now() - questionStartTime) / 1000).toFixed(1));

    const chordsNamesPlayed = correctSequence.map((c) => c.name.split(' - ')[0]).join(' ➜ ');

    setSessionHistory((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        questionLabel: `${scaleRoot} ${scaleType} Progression (${chordsNamesPlayed})`,
        isCorrect: accuracy === 100,
        timeTakenSec: elapsed,
      },
    ]);

    onAddScore(accuracy, elapsed, matchesCount, sequenceLength);
  };

  return (
    <div className="space-y-6">
      {/* Settings Panel */}
      <div className="glass-card rounded-3xl p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scale setup */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Root Note</label>
            <div className="grid grid-cols-6 gap-1.5">
              {CHROMATIC_NOTES.map((note) => (
                <button
                  key={note}
                  onClick={() => setScaleRoot(note)}
                  className={`py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    scaleRoot === note
                      ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Type</label>
              <select
                value={scaleType}
                onChange={(e) => setScaleType(e.target.value as any)}
                className="w-full glass-input text-xs font-semibold"
              >
                <option value="Major" className="bg-slate-900 text-white">Major</option>
                <option value="Natural Minor" className="bg-slate-900 text-white">Natural Minor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Chords Length</label>
              <select
                value={sequenceLength}
                onChange={(e) => setSequenceLength(parseInt(e.target.value, 10))}
                className="w-full glass-input text-xs font-semibold"
              >
                <option value={2} className="bg-slate-900 text-white">2 Chords</option>
                <option value={3} className="bg-slate-900 text-white">3 Chords</option>
                <option value={4} className="bg-slate-900 text-white">4 Chords</option>
                <option value={5} className="bg-slate-900 text-white">5 Chords</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Octave Range</label>
              <select
                value={octaveRange}
                onChange={(e) => setOctaveRange(e.target.value)}
                className="w-full glass-input text-xs font-semibold"
              >
                {OCTAVE_RANGES.map((r) => (
                  <option key={r.value} value={r.value} className="bg-slate-900 text-white">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Chords to include checklist */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-2.5">Chords to Include in Progression</label>
          <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1 border border-slate-100 dark:border-slate-800/80 p-2 rounded-xl">
            {activeDiatonicList.map((d, index) => {
              const isChecked = enabledDegrees.includes(index);
              const rootM = 12 * 5 + CHROMATIC_NOTES.indexOf(scaleRoot) + d.semitoneOffset;
              const letter = CHROMATIC_NOTES[rootM % 12];
              return (
                <button
                  key={index}
                  onClick={() => handleDegreeToggle(index)}
                  className={`w-full py-2 px-3.5 rounded-xl text-left text-xs font-semibold border transition-all ${
                    isChecked
                      ? 'bg-accent-500/10 border-accent-400 text-accent-600 dark:text-accent-400 font-bold'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {d.degreeName.split(' ')[0]} ({letter})
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 font-mono">
            Active Scale: <span className="font-bold text-music-600">{scaleRoot} {scaleType}</span>
          </p>
        </div>
      </div>

      {/* Playback Progression Console */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🎛️</span> Progression Dictation
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Listen to the progression sequence and type the chords in correct order.
            </p>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2 text-right">
            <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Perfect scores</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {scoreStats.correct} / {scoreStats.total}
            </span>
          </div>
        </div>

        {/* Progression Play block */}
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 mb-6">
          <div className="flex gap-2.5 mb-6">
            {Array.from({ length: sequenceLength }).map((_, idx) => {
              const isActive = activePlayIdx === idx;
              const hasBeenPlayed = activePlayIdx !== null && idx < activePlayIdx;
              return (
                <div
                  key={idx}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold border ${
                    isActive
                      ? 'border-music-500 bg-music-500 text-white shadow-lg animate-bounce'
                      : hasBeenPlayed
                      ? 'border-slate-300 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 text-slate-450'
                      : 'border-slate-200 dark:border-slate-805 text-slate-405'
                  }`}
                >
                  {idx + 1}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              onClick={playSequence}
              className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${
                isPlaying
                  ? 'bg-red-500'
                  : 'bg-gradient-to-tr from-music-600 to-accent-600 hover:from-music-500 hover:to-accent-500'
              }`}
            >
              {isPlaying ? <Square className="w-5 h-5 fill-white text-white" /> : <Volume2 className="w-6 h-6 text-white" />}
            </button>
            <button
              onClick={generateSequence}
              className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 flex items-center justify-center text-slate-650 dark:text-slate-350 hover:bg-slate-200 active:scale-95 transition-all"
              title="New Progression"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
          <span className="text-xs font-bold text-slate-450 mt-3.5">
            {isPlaying ? 'Listening to chord sequence...' : 'Play progression & guess order'}
          </span>
        </div>

        {/* User Sequence Entry Box */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-850 pb-2">
            <h3 className="font-display font-semibold text-xs text-slate-500 uppercase tracking-widest">
              Spell Chords Progression
            </h3>
            {!isAnswered && userSpelledNotes.some(notes => notes.length > 0) && (
              <button onClick={handleClearAllSlots} className="text-xs text-red-500 hover:underline font-semibold">
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: sequenceLength }).map((_, idx) => {
              const isSelected = activeSlot === idx;
              const isMatch = matchingResults[idx];
              const correctNotes = correctSequence[idx]?.correctNotes || [];
              const userNotes = userSpelledNotes[idx] || [];

              let slotStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 hover:border-music-400';
              if (isSelected) {
                slotStyle = 'border-music-500 ring-2 ring-music-500 bg-music-500/5 text-music-600 dark:text-music-400 font-bold';
              }
              if (isAnswered) {
                slotStyle = isMatch
                  ? 'bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 font-bold'
                  : 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-400 font-bold';
              }

              return (
                <button
                  key={idx}
                  onClick={() => !isAnswered && setActiveSlot(idx)}
                  disabled={isAnswered}
                  className={`flex-1 min-h-[72px] py-2 px-3 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all text-center ${slotStyle}`}
                >
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    Chord {idx + 1}
                  </span>
                  <span className="text-sm font-bold font-mono">
                    {userNotes.length > 0 ? userNotes.join(' - ') : '?'}
                  </span>
                  {isAnswered && !isMatch && (
                    <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 block pt-0.5 border-t border-red-200/40 dark:border-red-800/40 w-full mt-1">
                      Correct: {correctNotes.join(', ')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Spell pad */}
          {!isAnswered && (
            <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/60">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Spell Notes for Chord {activeSlot + 1}
              </span>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {CHROMATIC_NOTES.map((note) => {
                  const isActiveNote = (userSpelledNotes[activeSlot] || []).includes(note);
                  return (
                    <button
                      key={note}
                      onClick={() => handleToggleNoteForActiveSlot(note)}
                      className={`py-3 rounded-2xl text-sm font-bold border transition-all ${
                        isActiveNote
                          ? 'bg-music-600 border-music-600 text-white shadow-md shadow-music-500/10 scale-105'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-345 hover:border-music-400 active:scale-95'
                      }`}
                    >
                      {note}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action triggers */}
          <div className="flex gap-2.5 pt-4">
            {!isAnswered && (
              <>
                <button
                  onClick={handleClearActiveSlot}
                  disabled={isAnswered || (userSpelledNotes[activeSlot] || []).length === 0}
                  className="glass-button-secondary h-11 px-4 text-xs font-bold"
                >
                  Clear Chord {activeSlot + 1}
                </button>
                <button
                  onClick={() => setActiveSlot(prev => Math.max(0, prev - 1))}
                  disabled={activeSlot === 0}
                  className="glass-button-secondary h-11 px-4 text-xs font-bold"
                >
                  Prev Chord
                </button>
                <button
                  onClick={() => setActiveSlot(prev => Math.min(sequenceLength - 1, prev + 1))}
                  disabled={activeSlot === sequenceLength - 1}
                  className="glass-button-secondary h-11 px-4 text-xs font-bold"
                >
                  Next Chord
                </button>
              </>
            )}

            <button
              onClick={handleSubmitGuess}
              disabled={isAnswered || userSpelledNotes.some(notes => notes.length === 0)}
              className="glass-button-primary h-11 flex-1 text-xs font-bold"
            >
              {isAnswered ? 'Answer Submitted' : 'Submit Progression Spelling'}
            </button>
          </div>

          {/* Result Feedback */}
          {isAnswered && (
            <div className="p-5 rounded-3xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 mt-6">
              <div className="flex items-center gap-3.5">
                {matchingResults.every((r) => r) ? (
                  <CheckCircle2 className="w-10 h-10 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="w-10 h-10 text-red-500 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    {matchingResults.every((r) => r) ? 'Perfect progression spelling!' : 'Spelling check failed'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-450 mt-1 font-semibold">
                    Chords played: {correctSequence.map((c) => c.name.split(' - ')[0] + ` (${c.correctNotes.join(', ')})`).join(' ➜ ')}
                  </p>
                </div>
              </div>
              <button
                onClick={generateSequence}
                className="glass-button-primary h-11 px-6 text-xs font-bold shadow-md shadow-music-500/10 w-full md:w-auto shrink-0"
              >
                Next Progression
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Session Report Section */}
      {sessionHistory.length > 0 && (
        <div className="glass-card rounded-3xl p-6 mt-6">
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
              <span className="text-[10px] text-slate-450 block mt-0.5">per sequence</span>
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
export default ProgressionTrainer;
