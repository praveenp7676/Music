import React, { useState, useEffect } from 'react';
import { audioEngine } from '../utils/AudioEngine';
import { Play, Volume2, Award, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

interface IntervalTrainerProps {
  onAddScore: (accuracy: number, interval?: string, timeTakenSec?: number) => void;
}

interface SessionHistoryItem {
  id: number;
  questionLabel: string;
  isCorrect: boolean;
  timeTakenSec: number;
}

interface IntervalDef {
  name: string;
  semitones: number;
}

const INTERVALS: IntervalDef[] = [
  { name: 'Minor 2nd', semitones: 1 },
  { name: 'Major 2nd', semitones: 2 },
  { name: 'Minor 3rd', semitones: 3 },
  { name: 'Major 3rd', semitones: 4 },
  { name: 'Perfect 4th', semitones: 5 },
  { name: 'Tritone', semitones: 6 },
  { name: 'Perfect 5th', semitones: 7 },
  { name: 'Minor 6th', semitones: 8 },
  { name: 'Major 6th', semitones: 9 },
  { name: 'Minor 7th', semitones: 10 },
  { name: 'Major 7th', semitones: 11 },
  { name: 'Octave', semitones: 12 },
];

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const IntervalTrainer: React.FC<IntervalTrainerProps> = ({ onAddScore }) => {
  const [baseNote, setBaseNote] = useState('C4');
  const [targetNote, setTargetNote] = useState('G4');
  const [correctInterval, setCorrectInterval] = useState<IntervalDef>(INTERVALS[6]); // Perfect 5th default
  const [options, setOptions] = useState<string[]>([]);
  
  const [playDirection, setPlayDirection] = useState<'ascending' | 'descending' | 'harmonic'>('ascending');
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [scoreStats, setScoreStats] = useState({ correct: 0, total: 0 });

  // Time tracking and session stats
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  // Generate a new interval quiz question
  const generateQuestion = () => {
    audioEngine.stop();
    setSelectedOption(null);
    setIsAnswered(false);
    setQuestionStartTime(Date.now());

    // Pick random base note in C4-C5 range
    const baseIndex = Math.floor(Math.random() * 12); // C4 to B4
    const base = `${CHROMATIC_NOTES[baseIndex]}4`;
    setBaseNote(base);

    // Pick random interval
    const interval = INTERVALS[Math.floor(Math.random() * INTERVALS.length)];
    setCorrectInterval(interval);

    // Calculate target note
    const targetMidi = 12 * (4 + 1) + baseIndex + interval.semitones;
    const targetOctave = Math.floor(targetMidi / 12) - 1;
    const targetName = CHROMATIC_NOTES[targetMidi % 12];
    const target = `${targetName}${targetOctave}`;
    setTargetNote(target);

    // Generate options: correct option + 3 random ones
    const pool = INTERVALS.filter((i) => i.name !== interval.name);
    const shuffledPool = pool.sort(() => 0.5 - Math.random());
    const distractors = shuffledPool.slice(0, 3).map((i) => i.name);
    
    const finalOptions = [interval.name, ...distractors].sort(() => 0.5 - Math.random());
    setOptions(finalOptions);
  };

  useEffect(() => {
    generateQuestion();
  }, []);

  const playInterval = async () => {
    audioEngine.stop();
    
    if (playDirection === 'ascending') {
      await audioEngine.playNote(baseNote, 'q');
      setTimeout(() => {
        audioEngine.playNote(targetNote, 'q');
      }, 500);
    } else if (playDirection === 'descending') {
      await audioEngine.playNote(targetNote, 'q');
      setTimeout(() => {
        audioEngine.playNote(baseNote, 'q');
      }, 500);
    } else {
      // Harmonic: play together
      await audioEngine.playChord([baseNote, targetNote], 'h');
    }
  };

  const playOptionInterval = async (optionIntervalName: string) => {
    audioEngine.stop();
    const intervalDef = INTERVALS.find((i) => i.name === optionIntervalName);
    if (!intervalDef) return;

    // Parse baseNote to get MIDI index
    const noteName = baseNote.slice(0, -1);
    const octave = parseInt(baseNote.slice(-1), 10);
    const baseIndex = CHROMATIC_NOTES.indexOf(noteName);
    if (baseIndex === -1) return;

    const baseMidi = 12 * (octave + 1) + baseIndex;
    const targetMidi = baseMidi + intervalDef.semitones;
    const targetOctave = Math.floor(targetMidi / 12) - 1;
    const targetName = CHROMATIC_NOTES[targetMidi % 12];
    const optionTargetNote = `${targetName}${targetOctave}`;

    if (playDirection === 'ascending') {
      await audioEngine.playNote(baseNote, 'q');
      setTimeout(() => {
        audioEngine.playNote(optionTargetNote, 'q');
      }, 500);
    } else if (playDirection === 'descending') {
      await audioEngine.playNote(optionTargetNote, 'q');
      setTimeout(() => {
        audioEngine.playNote(baseNote, 'q');
      }, 500);
    } else {
      // Harmonic: play together
      await audioEngine.playChord([baseNote, optionTargetNote], 'h');
    }
  };

  // Re-play when generating or when changing play styles
  useEffect(() => {
    let timer: any;
    if (baseNote && targetNote) {
      // Small timeout to allow synth initialisation on click or load
      timer = setTimeout(() => {
        playInterval();
      }, 200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [baseNote, targetNote, playDirection]);

  const handleOptionSelect = (option: string) => {
    if (isAnswered) return;
    
    setSelectedOption(option);
    const correct = option === correctInterval.name;
    setIsCorrect(correct);
    setIsAnswered(true);
    setScoreStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    const elapsed = parseFloat(((Date.now() - questionStartTime) / 1000).toFixed(1));
    
    setSessionHistory((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        questionLabel: `${baseNote} to ${targetNote} (${correctInterval.name})`,
        isCorrect: correct,
        timeTakenSec: elapsed,
      },
    ]);

    // Trigger parent statistics logging
    onAddScore(correct ? 100 : 0, correctInterval.name, elapsed);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-6 relative overflow-hidden">
        {/* Header Stats */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🎯</span> Interval Recognition
            </h2>
            <p className="text-xs text-slate-500 mt-1">Identify the interval played between two notes.</p>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2 text-right">
            <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Score</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {scoreStats.correct} / {scoreStats.total}
            </span>
          </div>
        </div>

        {/* Play Direction Selectors */}
        <div className="flex justify-center gap-2 mb-6">
          {(['ascending', 'descending', 'harmonic'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setPlayDirection(dir)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize border transition-all ${
                playDirection === dir
                  ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500'
              }`}
            >
              {dir}
            </button>
          ))}
        </div>

        {/* Central Play Ring */}
        <div className="flex flex-col items-center justify-center py-6">
          <button
            onClick={playInterval}
            className="w-24 h-24 rounded-full bg-gradient-to-tr from-music-600 to-accent-600 hover:from-music-500 hover:to-accent-500 text-white flex items-center justify-center shadow-lg shadow-music-500/25 active:scale-95 transition-all mb-4"
          >
            <Volume2 className="w-8 h-8" />
          </button>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
            Click to play interval sound
          </span>
        </div>

        {/* Answer Options */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {options.map((option) => {
            const isSelected = selectedOption === option;
            let btnStyle = 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850';
            
            if (isAnswered) {
              if (option === correctInterval.name) {
                // Correct answer is highlighted in green
                btnStyle = 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300 font-bold hover:bg-green-500/20 active:scale-95 cursor-pointer';
              } else if (isSelected) {
                // Selected wrong option is highlighted in red
                btnStyle = 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 font-bold hover:bg-red-500/20 active:scale-95 cursor-pointer';
              } else {
                btnStyle = 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100 hover:bg-slate-50 dark:hover:bg-slate-850 active:scale-95 cursor-pointer';
              }
            } else if (isSelected) {
              btnStyle = 'border-music-500 bg-music-500/5 text-music-600';
            }

            return (
              <button
                key={option}
                onClick={() => {
                  if (isAnswered) {
                    playOptionInterval(option);
                  } else {
                    handleOptionSelect(option);
                  }
                }}
                className={`py-4 px-2 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 relative ${btnStyle}`}
              >
                <span>{option}</span>
                {isAnswered && (
                  <Volume2 className="w-4 h-4 text-current opacity-70 hover:opacity-100 transition-opacity" />
                )}
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
                  Interval was a <span className="font-semibold text-slate-700 dark:text-slate-300">{correctInterval.name}</span> ({baseNote} to {targetNote}).
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
export default IntervalTrainer;
