import React, { useState, useEffect } from 'react';
import { Note, TimeSignature } from '../types';
import { generateMelody } from '../utils/melodyGen';
import { audioEngine } from '../utils/AudioEngine';
import { SheetMusic } from './SheetMusic';
import { Play, Volume2, Award, RefreshCw, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';

interface RhythmDictationProps {
  onAddScore: (accuracy: number) => void;
}

export const RhythmDictation: React.FC<RhythmDictationProps> = ({ onAddScore }) => {
  const [correctRhythm, setCorrectRhythm] = useState<Note[]>([]);
  const [options, setOptions] = useState<Note[][]>([]);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  
  const [showAnswerSheet, setShowAnswerSheet] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [scoreStats, setScoreStats] = useState({ correct: 0, total: 0 });

  const generateQuestion = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
    setSelectedOption(null);
    setIsAnswered(false);
    setShowAnswerSheet(false);

    // Randomize time signature: 2/4, 3/4, 4/4, 6/8
    const sigs: TimeSignature[] = ['2/4', '3/4', '4/4', '6/8'];
    const currentSig = sigs[Math.floor(Math.random() * sigs.length)];
    setTimeSignature(currentSig);

    const rhythms = {
      whole: currentSig === '4/4', // only whole note in 4/4
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: false,
      dotted: false,
      rests: Math.random() < 0.5,
    };

    // Generate correct answer rhythm (all pitches on C4)
    const correct = generateMelody({
      allowedNotes: ['C'],
      selectedScales: [],
      enabledRhythms: rhythms,
      timeSignature: currentSig,
      difficulty: 'beginner',
      length: 6, // 6 notes/rests target
    }).map((n) => ({ ...n, pitch: 'C4' })); // Force monotone C4
    setCorrectRhythm(correct);

    // Generate 2 distractor rhythms
    const dist1 = generateMelody({
      allowedNotes: ['C'],
      selectedScales: [],
      enabledRhythms: rhythms,
      timeSignature: currentSig,
      difficulty: 'beginner',
      length: 6,
    }).map((n) => ({ ...n, pitch: 'C4' }));

    const dist2 = generateMelody({
      allowedNotes: ['C'],
      selectedScales: [],
      enabledRhythms: rhythms,
      timeSignature: currentSig,
      difficulty: 'beginner',
      length: 6,
    }).map((n) => ({ ...n, pitch: 'C4' }));

    // Shuffle options
    const choices = [correct, dist1, dist2];
    const shuffled = choices
      .map((val) => ({ val, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ val }) => val);

    setOptions(shuffled);
  };

  useEffect(() => {
    generateQuestion();
  }, []);

  const playRhythm = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setActiveNoteIndex(null);
      return;
    }

    setIsPlaying(true);
    // Use woodblock/perc sound by using guitar/synth settings or playing C4 notes
    audioEngine.setTempo(100);
    audioEngine.setInstrument('synth'); // clear clean transient synth click
    audioEngine.playMelody(
      correctRhythm,
      (idx) => {
        setActiveNoteIndex(idx);
      },
      () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
      }
    );
  };

  const handleOptionSelect = (idx: number) => {
    if (isAnswered) return;

    setSelectedOption(idx);
    const correctPitches = correctRhythm.map((n) => `${n.type}-${n.duration}`).join(',');
    const selectedPitches = options[idx].map((n) => `${n.type}-${n.duration}`).join(',');
    const correct = correctPitches === selectedPitches;
    
    setIsCorrect(correct);
    setIsAnswered(true);
    setShowAnswerSheet(true); // reveal notation
    setScoreStats((prev) => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));

    onAddScore(correct ? 100 : 0);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🥁</span> Rhythm Dictation
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Listen to the pulse and identify the correct rhythmic notation.
            </p>
          </div>
          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2 text-right">
            <span className="text-xs text-slate-400 block uppercase font-bold tracking-wider">Score</span>
            <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
              {scoreStats.correct} / {scoreStats.total}
            </span>
          </div>
        </div>

        {/* Pulse / Rhythm Play Section */}
        <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 mb-6">
          <div className="text-center mb-3">
            <span className="text-2xl font-bold font-mono tracking-widest text-slate-700 dark:text-slate-300">
              {timeSignature}
            </span>
            <p className="text-[10px] text-slate-400 mt-0.5">TIME SIGNATURE</p>
          </div>
          <button
            onClick={playRhythm}
            className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${
              isPlaying
                ? 'bg-red-500 shadow-red-500/20'
                : 'bg-gradient-to-tr from-music-600 to-accent-600 hover:from-music-500 hover:to-accent-500 shadow-music-500/20'
            }`}
          >
            <Play className={`w-7 h-7 text-white fill-white ${isPlaying ? 'hidden' : 'translate-x-0.5'}`} />
            <span className={`text-xs font-bold ${isPlaying ? 'block animate-pulse-slow' : 'hidden'}`}>
              Playing
            </span>
          </button>
          <span className="text-xs font-bold text-slate-400 mt-3 select-none">
            {isPlaying ? 'Count beats & listen closely' : 'Click to hear the rhythm'}
          </span>
        </div>

        {/* Reveal Correct Answer Toggle */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display font-bold text-sm text-slate-700 dark:text-slate-300">
            Compare Options
          </h3>
          <button
            onClick={() => setShowAnswerSheet(!showAnswerSheet)}
            className="text-xs font-semibold text-music-600 dark:text-music-400 flex items-center gap-1.5"
          >
            {showAnswerSheet ? (
              <>
                <EyeOff className="w-3.5 h-3.5" /> Hide Notations
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" /> Cheat Sheet (Reveal)
              </>
            )}
          </button>
        </div>

        {/* Notation Options (Quiz Choices) */}
        <div className="grid grid-cols-1 gap-6">
          {options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const correctPitches = correctRhythm.map((n) => `${n.type}-${n.duration}`).join(',');
            const currentPitches = option.map((n) => `${n.type}-${n.duration}`).join(',');
            const isCorrectOption = correctPitches === currentPitches;
            
            let blockStyle = 'border-slate-200 dark:border-slate-800 hover:border-music-400';
            let labelText = `Option ${idx + 1}`;

            if (isAnswered) {
              if (isCorrectOption) {
                blockStyle = 'border-green-500 bg-green-500/5';
                labelText = `Option ${idx + 1} (Correct Answer)`;
              } else if (isSelected) {
                blockStyle = 'border-red-500 bg-red-500/5';
                labelText = `Option ${idx + 1} (Your Choice - Wrong)`;
              } else {
                blockStyle = 'border-slate-100 dark:border-slate-900 opacity-60';
              }
            } else if (isSelected) {
              blockStyle = 'border-music-500 bg-music-500/5';
            }

            return (
              <div
                key={idx}
                onClick={() => handleOptionSelect(idx)}
                className={`p-4 rounded-3xl border transition-all cursor-pointer ${blockStyle}`}
              >
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {labelText}
                  </span>
                  {!isAnswered && (
                    <button className="text-xs text-music-600 font-semibold">Select</button>
                  )}
                </div>

                {/* Render sheet music if revealed or answered */}
                {showAnswerSheet || isAnswered ? (
                  <SheetMusic
                    notes={option}
                    timeSignature={timeSignature}
                    activeNoteIndex={
                      isCorrectOption && isPlaying ? activeNoteIndex : null
                    }
                  />
                ) : (
                  <div className="h-28 bg-slate-100 dark:bg-slate-900/60 rounded-2xl flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-850">
                    <p className="text-xs text-slate-400 font-mono italic">
                      Notation hidden. Listen first!
                    </p>
                  </div>
                )}
              </div>
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
                  {isCorrect ? 'Outstanding! Right Rhythm.' : 'Whoops! That was incorrect.'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Listen again or generate a new practice session to improve your dictation.
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
    </div>
  );
};
export default RhythmDictation;
