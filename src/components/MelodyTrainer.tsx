import React, { useState, useEffect } from 'react';
import { Note, TimeSignature, Difficulty, PlaybackMode, MusicStyle, InstrumentType } from '../types';
import { SheetMusic } from './SheetMusic';
import { generateMelody, getScaleNotes } from '../utils/melodyGen';
import { audioEngine } from '../utils/AudioEngine';
import { exportToMidi } from '../utils/midi';
import { exportToMusicXml } from '../utils/musicxml';
import { Play, Square, RefreshCw, Download, FileAudio, Settings, HelpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MelodyTrainerProps {
  onAddScore: (accuracy: number, timeTakenSec?: number, subCorrect?: number, subTotal?: number) => void;
}

interface SessionHistoryItem {
  id: number;
  questionLabel: string;
  isCorrect: boolean;
  timeTakenSec: number;
}

export const MelodyTrainer: React.FC<MelodyTrainerProps> = ({ onAddScore }) => {
  // Local storage state keys
  const getSaved = (key: string, fallback: any) => {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  };

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Configuration States
  const [allowedNotes, setAllowedNotes] = useState<string[]>(
    () => getSaved('allowedNotes', ['C', 'D', 'E', 'F', 'G', 'A', 'B'])
  );
  const [tempo, setTempo] = useState<number>(() => getSaved('tempo', 100));
  const [enabledRhythms, setEnabledRhythms] = useState<Record<string, boolean>>(() =>
    getSaved('enabledRhythms', {
      whole: true,
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: false,
      dotted: false,
      rests: false,
    })
  );
  const [timeSignature, setTimeSignature] = useState<TimeSignature>(
    () => getSaved('timeSignature', '4/4')
  );
  const [isRandomTimeSig, setIsRandomTimeSig] = useState<boolean>(
    () => getSaved('isRandomTimeSig', false)
  );
  const [scaleRoot, setScaleRoot] = useState<string>(() => {
    const saved = getSaved('selectedScales', ['C Major']);
    return saved[0]?.split(' ')[0] || 'C';
  });
  const [scaleType, setScaleType] = useState<string>(() => {
    const saved = getSaved('selectedScales', ['C Major']);
    const parts = saved[0]?.split(' ');
    parts.shift();
    return parts.join(' ') || 'Major';
  });
  const selectedScales = [`${scaleRoot} ${scaleType}`];
  const [melodyLength, setMelodyLength] = useState<number>(
    () => getSaved('melodyLength', 8)
  );
  const [customLength, setCustomLength] = useState<string>('8');
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => getSaved('difficulty', 'intermediate')
  );
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(
    () => getSaved('playbackMode', 'manual')
  );
  const [instrument, setInstrument] = useState<InstrumentType>(
    () => getSaved('instrument', 'piano')
  );

  // AI Generation configuration
  const [aiMode, setAiMode] = useState<boolean>(false);
  const [aiStyle, setAiStyle] = useState<MusicStyle>('classical');

  // Interactive Quiz States (Note-by-Note Dictation)
  const [quizActive, setQuizActive] = useState(false);
  const [userEnteredQuizNotes, setUserEnteredQuizNotes] = useState<string[]>([]);
  const [quizChecked, setQuizChecked] = useState(false);
  const [quizAccuracy, setQuizAccuracy] = useState<number | null>(null);
  const [quizNoteMatches, setQuizNoteMatches] = useState<boolean[]>([]);

  // Time tracking and session stats
  const [questionStartTime, setQuestionStartTime] = useState<number>(Date.now());
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);

  // Constants
  const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SCALES_OPTIONS = [
    'C Major', 'G Major', 'D Major', 'A Major', 'E Major', 'F Major', 'Bb Major',
    'C Natural Minor', 'C Harmonic Minor', 'C Melodic Minor',
    'C Ionian', 'C Dorian', 'C Phrygian', 'C Lydian', 'C Mixolydian', 'C Aeolian', 'C Locrian'
  ];

  // Save Settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('allowedNotes', JSON.stringify(allowedNotes));
    localStorage.setItem('tempo', JSON.stringify(tempo));
    localStorage.setItem('enabledRhythms', JSON.stringify(enabledRhythms));
    localStorage.setItem('timeSignature', JSON.stringify(timeSignature));
    localStorage.setItem('isRandomTimeSig', JSON.stringify(isRandomTimeSig));
    localStorage.setItem('selectedScales', JSON.stringify(selectedScales));
    localStorage.setItem('melodyLength', JSON.stringify(melodyLength));
    localStorage.setItem('difficulty', JSON.stringify(difficulty));
    localStorage.setItem('playbackMode', JSON.stringify(playbackMode));
    localStorage.setItem('instrument', JSON.stringify(instrument));
  }, [allowedNotes, tempo, enabledRhythms, timeSignature, isRandomTimeSig, scaleRoot, scaleType, melodyLength, difficulty, playbackMode, instrument]);

  // Handle Instrument Switch
  useEffect(() => {
    audioEngine.setInstrument(instrument);
  }, [instrument]);

  // Generate Initial Melody and regenerate when settings change
  useEffect(() => {
    handleGenerate();
  }, [allowedNotes, scaleRoot, scaleType, enabledRhythms, melodyLength, difficulty, aiMode, aiStyle]);

  const handleGenerate = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
    setQuizChecked(false);
    setUserEnteredQuizNotes([]);
    setQuizAccuracy(null);
    setQuizNoteMatches([]);
    setQuestionStartTime(Date.now());

    // Randomize time signature if enabled
    let currentSig = timeSignature;
    if (isRandomTimeSig) {
      const sigs: TimeSignature[] = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8'];
      const rand = sigs[Math.floor(Math.random() * sigs.length)];
      currentSig = rand;
      setTimeSignature(rand);
    }

    const generated = generateMelody({
      allowedNotes,
      selectedScales,
      enabledRhythms,
      timeSignature: currentSig,
      difficulty,
      length: melodyLength,
      style: aiStyle,
      aiMode,
    });

    setNotes(generated);
  };



  const handleToggleNote = (note: string) => {
    if (allowedNotes.includes(note)) {
      if (allowedNotes.length > 1) {
        setAllowedNotes(allowedNotes.filter((n) => n !== note));
      }
    } else {
      setAllowedNotes([...allowedNotes, note]);
    }
  };

  const handleRhythmToggle = (key: string) => {
    setEnabledRhythms({
      ...enabledRhythms,
      [key]: !enabledRhythms[key],
    });
  };



  const handlePlay = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setActiveNoteIndex(null);
      return;
    }

    setIsPlaying(true);
    audioEngine.setTempo(tempo);
    
    // Slow practice: Play at 50% speed
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
            // Repeat playback
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

  const handleQuizSubmit = () => {
    const correctLetters = notes.map((n) =>
      n.type === 'rest' || n.pitch === 'R' ? 'R' : n.pitch.replace(/\d+$/, '')
    );

    // Pad user guess to target length if submitted early
    const paddedGuess = [...userEnteredQuizNotes];
    while (paddedGuess.length < correctLetters.length) {
      paddedGuess.push('');
    }

    const matches = correctLetters.map((correct, idx) => paddedGuess[idx] === correct);
    setQuizNoteMatches(matches);

    const correctCount = matches.filter((m) => m).length;
    const accuracyVal = Math.round((correctCount / correctLetters.length) * 100);
    setQuizAccuracy(accuracyVal);
    setQuizChecked(true);

    const elapsed = parseFloat(((Date.now() - questionStartTime) / 1000).toFixed(1));

    setSessionHistory((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        questionLabel: `Melody Dictation (${notes.length} Notes, ${difficulty} style)`,
        isCorrect: accuracyVal === 100,
        timeTakenSec: elapsed,
      },
    ]);

    onAddScore(accuracyVal, elapsed, correctCount, correctLetters.length);
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Notation Panel */}
      <div className="glass-card rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🎵</span> Active Melody
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {notes.length} notes &bull; Time Signature: {timeSignature} &bull; Difficulty: {difficulty.toUpperCase()}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePlay}
              className={`glass-button-primary w-12 h-12 rounded-full !p-0 ${
                isPlaying ? 'from-red-600 to-red-500 shadow-red-500/20' : ''
              }`}
              title={isPlaying ? 'Stop' : 'Play'}
            >
              {isPlaying ? <Square className="w-5 h-5 text-white fill-white" /> : <Play className="w-5 h-5 text-white fill-white translate-x-0.5" />}
            </button>
            <button
              onClick={handleGenerate}
              className="glass-button-secondary w-12 h-12 rounded-full !p-0"
              title="Generate New Melody"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1.5" />
            
            <button
              onClick={() => exportToMidi(notes, `melody_${tempo}bpm`)}
              className="glass-button-secondary gap-1.5 text-xs py-2 px-3 h-10 rounded-xl"
              title="Export as MIDI"
            >
              <Download className="w-4 h-4" /> MIDI
            </button>
            <button
              onClick={() => exportToMusicXml(notes, timeSignature, `melody_exercise`)}
              className="glass-button-secondary gap-1.5 text-xs py-2 px-3 h-10 rounded-xl"
              title="Export as MusicXML"
            >
              <FileAudio className="w-4 h-4" /> XML
            </button>
          </div>
        </div>

        {/* Notation Box */}
        <SheetMusic notes={notes} timeSignature={timeSignature} activeNoteIndex={activeNoteIndex} />
        
        {/* Playback Progress Indicator */}
        {isPlaying && (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-music-600 dark:text-music-400 animate-pulse-slow">
            <span className="w-2 h-2 rounded-full bg-music-500"></span>
            Playing Melody ({tempo} BPM)
          </div>
        )}
      </div>

      {/* Quiz Mode Overlay */}
      <div className="glass-card rounded-3xl p-6">
        <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4 mb-4">
          <div>
            <h3 className="font-display font-bold text-lg">Melodic Dictation Quiz</h3>
            <p className="text-xs text-slate-500">Listen to the active melody, then input the note letters in order.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={quizActive}
              onChange={(e) => {
                setQuizActive(e.target.checked);
                if (e.target.checked) {
                  setUserEnteredQuizNotes([]);
                  setQuizChecked(false);
                  setQuizAccuracy(null);
                }
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-music-600"></div>
          </label>
        </div>

        {quizActive && (
          <div className="space-y-5">
            {/* Target length indicator */}
            <p className="text-xs font-semibold text-slate-500">
              Melody Length: <span className="font-bold text-music-600">{notes.length} notes</span>
            </p>

            {/* User Entered Notes progress bar */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 min-h-[64px] flex flex-wrap gap-2 items-center">
              {Array.from({ length: notes.length }).map((_, idx) => {
                const guessedNote = userEnteredQuizNotes[idx];
                const isChecked = quizChecked;
                const isMatch = quizNoteMatches[idx];
                
                let boxStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300';
                
                if (isChecked) {
                  boxStyle = isMatch
                    ? 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300 font-bold'
                    : 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300 font-bold';
                } else if (userEnteredQuizNotes.length === idx) {
                  // Next active box
                  boxStyle = 'border-music-500 ring-2 ring-music-500/20 bg-white dark:bg-slate-950 text-music-600';
                }

                return (
                  <div
                    key={idx}
                    className={`w-11 h-11 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition-all relative ${boxStyle}`}
                  >
                    <span className="text-[8px] text-slate-400 absolute top-1 font-mono">{idx + 1}</span>
                    <span className="mt-2.5">{guessedNote || ''}</span>
                  </div>
                );
              })}
            </div>

            {/* Note Keyboard Pads */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Click to enter notes
              </span>
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {CHROMATIC_SCALE.map((note) => (
                  <button
                    key={note}
                    onClick={() => {
                      if (userEnteredQuizNotes.length < notes.length && !quizChecked) {
                        setUserEnteredQuizNotes([...userEnteredQuizNotes, note]);
                      }
                    }}
                    disabled={userEnteredQuizNotes.length >= notes.length || quizChecked}
                    className="py-2.5 px-1 rounded-xl text-xs font-bold border bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-music-400 disabled:opacity-50 transition-all"
                  >
                    {note}
                  </button>
                ))}
                {/* Rest pad */}
                <button
                  onClick={() => {
                    if (userEnteredQuizNotes.length < notes.length && !quizChecked) {
                      setUserEnteredQuizNotes([...userEnteredQuizNotes, 'R']);
                    }
                  }}
                  disabled={userEnteredQuizNotes.length >= notes.length || quizChecked}
                  className="py-2.5 px-1 rounded-xl text-xs font-bold border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-music-400 disabled:opacity-50 transition-all text-slate-500"
                >
                  Rest (R)
                </button>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2 border-t border-slate-150 dark:border-slate-800/80 pt-4">
              <button
                onClick={() => {
                  if (!quizChecked) {
                    setUserEnteredQuizNotes(userEnteredQuizNotes.slice(0, -1));
                  }
                }}
                disabled={userEnteredQuizNotes.length === 0 || quizChecked}
                className="glass-button-secondary py-2 px-4 text-xs gap-1.5 rounded-xl h-11"
              >
                Backspace
              </button>
              <button
                onClick={() => {
                  if (!quizChecked) setUserEnteredQuizNotes([]);
                }}
                disabled={userEnteredQuizNotes.length === 0 || quizChecked}
                className="glass-button-secondary py-2 px-4 text-xs rounded-xl h-11"
              >
                Clear
              </button>
              <button
                onClick={handleQuizSubmit}
                disabled={userEnteredQuizNotes.length === 0 || quizChecked}
                className="glass-button-primary py-2 px-6 flex-1 text-xs rounded-xl h-11"
              >
                Submit Dictation Guess
              </button>
            </div>

            {/* Results feedback */}
            {quizChecked && quizAccuracy !== null && (
              <div className="p-4 rounded-2xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {quizAccuracy === 100 ? (
                    <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-bold text-sm">
                      {quizAccuracy === 100 ? 'Perfect Ear! Correct.' : `Completed with ${quizAccuracy}% accuracy`}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Correct sequence: <span className="font-bold font-mono text-slate-700 dark:text-slate-350">{notes.map(n => n.type === 'rest' ? 'R' : n.pitch.replace(/\d+$/, '')).join(' ➜ ')}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleGenerate}
                  className="glass-button-primary py-2 px-4 text-xs font-semibold shadow-none whitespace-nowrap"
                >
                  Next Melody
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Settings Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Column 1: Note Selection & Tempo */}
        <div className="space-y-6">
          {/* Note Selector */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <span>🎯</span> Note Selection
            </h3>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {CHROMATIC_SCALE.map((note) => {
                const isSelected = allowedNotes.includes(note);
                return (
                  <button
                    key={note}
                    onClick={() => handleToggleNote(note)}
                    className={`py-2 px-1 rounded-xl text-sm font-semibold border transition-all ${
                      isSelected
                        ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {note}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2.5">
              Select which pitches will appear in the randomly generated melodies.
            </p>
          </div>

          {/* Tempo & Instrument Control */}
          <div className="glass-card rounded-3xl p-6 space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-display font-bold text-slate-800 dark:text-slate-100">Tempo: {tempo} BPM</h3>
              </div>
              <input
                type="range"
                min="40"
                max="200"
                step="20"
                value={tempo}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setTempo(val);
                  audioEngine.setTempo(val);
                }}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-music-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-mono">
                <span>40 BPM</span>
                <span>120 BPM</span>
                <span>200 BPM</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Instrument</label>
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value as InstrumentType)}
                  className="w-full glass-input text-xs"
                >
                  <option value="piano">Piano (High Res)</option>
                  <option value="violin">Violin (Sustain)</option>
                  <option value="flute">Flute (Breathy)</option>
                  <option value="guitar">Guitar (Nylon)</option>
                  <option value="synth">Synthesizer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Playback Mode</label>
                <select
                  value={playbackMode}
                  onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
                  className="w-full glass-input text-xs"
                >
                  <option value="manual">Manual Play</option>
                  <option value="auto-repeat">Auto Repeat</option>
                  <option value="slow">Slow Practice (50%)</option>
                  <option value="call-and-response">Call & Response</option>
                </select>
              </div>
            </div>
          </div>

          {/* AI Mode Selection */}
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-3 mb-4">
              <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>🧠</span> AI Generation Style
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiMode}
                  onChange={(e) => setAiMode(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-music-600"></div>
              </label>
            </div>

            {aiMode ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {(['classical', 'film', 'jazz', 'pop'] as MusicStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setAiStyle(style)}
                    className={`py-2 px-1 rounded-xl text-xs font-semibold border capitalize transition-all ${
                      aiStyle === style
                        ? 'bg-accent-500/10 border-accent-400 text-accent-600 dark:text-accent-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Enable AI generation to simulate musical patterns of specific eras/genres rather than purely random pitch leaps.
              </p>
            )}
          </div>
        </div>

        {/* Column 2: Scales, Rhythms & Metres */}
        <div className="space-y-6">
          {/* Scale selection */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🎼</span> Scale Alignment
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Root Note</label>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
                  {CHROMATIC_SCALE.map((note) => (
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

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">Scale Type</label>
                <select
                  value={scaleType}
                  onChange={(e) => setScaleType(e.target.value)}
                  className="w-full glass-input text-xs"
                >
                  {['Major', 'Natural Minor', 'Harmonic Minor', 'Melodic Minor', 'Ionian', 'Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Aeolian', 'Locrian'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-450 mt-2 font-mono">
                  Scale: <span className="font-bold text-music-600">{scaleRoot} {scaleType}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Time Signature and Difficulty */}
          <div className="glass-card rounded-3xl p-6 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-display font-semibold text-xs text-slate-500 mb-2">Time Signature</h3>
              <select
                value={timeSignature}
                onChange={(e) => {
                  const val = e.target.value as TimeSignature;
                  setTimeSignature(val);
                  setIsRandomTimeSig(false);
                  setTimeout(() => handleGenerate(), 0);
                }}
                disabled={isRandomTimeSig}
                className="w-full glass-input text-xs h-10"
              >
                <option value="2/4">2/4</option>
                <option value="3/4">3/4</option>
                <option value="4/4">4/4</option>
                <option value="5/4">5/4</option>
                <option value="6/8">6/8</option>
                <option value="7/8">7/8</option>
                <option value="9/8">9/8</option>
                <option value="12/8">12/8</option>
              </select>
              <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRandomTimeSig}
                  onChange={(e) => {
                    setIsRandomTimeSig(e.target.checked);
                    setTimeout(() => handleGenerate(), 0);
                  }}
                  className="rounded text-music-600"
                />
                <span className="text-[10px] text-slate-500 select-none">Randomize each time</span>
              </label>
            </div>

            <div>
              <h3 className="font-display font-semibold text-xs text-slate-500 mb-2">Difficulty (Intervals)</h3>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                className="w-full glass-input text-xs h-10"
              >
                <option value="beginner">Beginner (Stepwise)</option>
                <option value="intermediate">Intermediate (Small Leaps)</option>
                <option value="advanced">Advanced (Large Leaps)</option>
                <option value="expert">Expert (Any Interval)</option>
              </select>
            </div>
          </div>

          {/* Rhythm Generator settings */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>🥁</span> Rhythm Patterns
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.keys(enabledRhythms).map((key) => {
                const isChecked = enabledRhythms[key];
                return (
                  <button
                    key={key}
                    onClick={() => handleRhythmToggle(key)}
                    className={`py-2 px-2 rounded-xl text-[11px] font-semibold border capitalize transition-all ${
                      isChecked
                        ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    {key.replace(/([A-Z])/g, ' $1')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Melody length options */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="font-display font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>📏</span> Melody Length
            </h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {[4, 8, 16, 32].map((len) => (
                <button
                  key={len}
                  onClick={() => setMelodyLength(len)}
                  className={`py-2 px-3.5 rounded-xl text-xs font-semibold border transition-all ${
                    melodyLength === len && customLength === ''
                      ? 'bg-music-500/10 border-music-400 text-music-600 dark:text-music-400'
                      : 'border-slate-200 dark:border-slate-800 text-slate-500'
                  }`}
                >
                  {len === 4 ? 'Very Short' : len === 8 ? 'Short' : len === 16 ? 'Medium' : 'Long'} ({len})
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Custom:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={customLength}
                onChange={(e) => {
                  setCustomLength(e.target.value);
                  const val = parseInt(e.target.value, 10);
                  if (val > 0 && val <= 100) {
                    setMelodyLength(val);
                  }
                }}
                className="w-20 glass-input text-xs py-1 px-2.5 h-8"
              />
              <span className="text-[10px] text-slate-400">(1 to 100 notes)</span>
            </div>
          </div>
        </div>
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
