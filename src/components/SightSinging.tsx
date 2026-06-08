import React, { useState, useEffect, useRef } from 'react';
import { Note, TimeSignature } from '../types';
import { generateMelody } from '../utils/melodyGen';
import { audioEngine } from '../utils/AudioEngine';
import { SheetMusic } from './SheetMusic';
import { detectPitch, frequencyToPitch, getPitchDistance } from '../utils/pitchDetection';
import { Mic, MicOff, Play, Square, Award, RefreshCw, Volume2 } from 'lucide-react';

interface SightSingingProps {
  onAddScore: (accuracy: number) => void;
}

export const SightSinging: React.FC<SightSingingProps> = ({ onAddScore }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  
  // Mic States
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [currentPitch, setCurrentPitch] = useState<string | null>(null);
  const [currentFreq, setCurrentFreq] = useState<number>(0);
  const [targetPitchText, setTargetPitchText] = useState<string>('');
  const [pitchHistory, setPitchHistory] = useState<Array<{ time: number; target: number; sung: number }>>([]);
  
  // Accuracy Score States
  const [hasSung, setHasSung] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isPlayingTarget, setIsPlayingTarget] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);

  // Audio nodes refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Timing refs
  const recordingStartTimeRef = useRef<number>(0);
  const notesTimingRef = useRef<Array<{ start: number; end: number; pitch: string }>>([]);

  const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const getNoteValue = (pitch: string): number => {
    const match = pitch.match(/^([A-G]#?|Bb?)(\d)$/i);
    if (!match) return 60;
    const [, name, octStr] = match;
    const octave = parseInt(octStr, 10);
    let nameIdx = CHROMATIC_NOTES.indexOf(name.toUpperCase());
    if (nameIdx === -1) nameIdx = 0;
    return nameIdx + (octave + 1) * 12;
  };

  const handleGenerate = () => {
    audioEngine.stop();
    setIsPlayingTarget(false);
    setActiveNoteIndex(null);
    stopRecording();
    setHasSung(false);
    setAccuracy(null);
    setPitchHistory([]);

    const generated = generateMelody({
      allowedNotes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      selectedScales: ['C Major'],
      enabledRhythms: { whole: false, half: true, quarter: true, eighth: false, sixteenth: false, dotted: false, rests: false },
      timeSignature: '4/4',
      difficulty: 'beginner',
      length: 6, // 6 notes stepwise, easy to sing
    });

    setNotes(generated);
  };

  useEffect(() => {
    handleGenerate();
    return () => {
      stopRecording();
    };
  }, []);

  const playTargetMelody = () => {
    if (isPlayingTarget) {
      audioEngine.stop();
      setIsPlayingTarget(false);
      setActiveNoteIndex(null);
      return;
    }

    setIsPlayingTarget(true);
    audioEngine.setTempo(80); // slow tempo for sight singing
    audioEngine.setInstrument('piano');
    audioEngine.playMelody(
      notes,
      (idx) => {
        setActiveNoteIndex(idx);
      },
      () => {
        setIsPlayingTarget(false);
        setActiveNoteIndex(null);
      }
    );
  };

  const startRecordingFlow = async () => {
    setHasSung(false);
    setAccuracy(null);
    setPitchHistory([]);
    
    // 1. Countdown 3 seconds
    setCountdown(3);
    const countInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countInterval);
          startMicCapture();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startMicCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      source.connect(analyser);

      // Precompute target note timing envelopes (at 80 BPM, 1 beat = 0.75 seconds)
      const secPerBeat = 60 / 80;
      let accumTime = 0;
      const timingList = notes.map((note) => {
        const beats = note.duration === 'h' ? 2 : 1; // simple map
        const durationSecs = beats * secPerBeat;
        const start = accumTime;
        const end = accumTime + durationSecs;
        accumTime = end;
        return { start, end, pitch: note.pitch };
      });
      notesTimingRef.current = timingList;

      recordingStartTimeRef.current = audioCtx.currentTime;
      setIsRecording(true);
      
      // Clear history list
      setPitchHistory([]);
      
      // Start tracking loop
      trackPitch();

      // Automatically stop after notes time duration ends
      const totalDuration = accumTime;
      setTimeout(() => {
        stopRecording(true);
      }, totalDuration * 1000 + 500);

    } catch (err) {
      alert('Microphone access is required for sight singing.');
      setCountdown(null);
    }
  };

  const stopRecording = (evaluateScore = false) => {
    setIsRecording(false);
    setCountdown(null);
    setCurrentPitch(null);
    setCurrentFreq(0);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (evaluateScore) {
      calculateSingingAccuracy();
    }
  };

  const trackPitch = () => {
    if (!analyserRef.current || !audioContextRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(dataArray);

    const sampleRate = audioContextRef.current.sampleRate;
    const freq = detectPitch(dataArray, sampleRate);
    const elapsed = audioContextRef.current.currentTime - recordingStartTimeRef.current;

    // Determine current target note
    const activeNote = notesTimingRef.current.find((t) => elapsed >= t.start && elapsed <= t.end);
    
    if (activeNote) {
      setTargetPitchText(activeNote.pitch);
      
      if (freq > 0) {
        const pitchDetails = frequencyToPitch(freq);
        if (pitchDetails) {
          setCurrentPitch(pitchDetails.note);
          setCurrentFreq(freq);

          // Numeric values for graph charting
          const sungMidi = getNoteValue(pitchDetails.note);
          const targetMidi = getNoteValue(activeNote.pitch);

          // Append to chart history
          setPitchHistory((prev) => [
            ...prev,
            { time: Math.round(elapsed * 10) / 10, target: targetMidi, sung: sungMidi }
          ]);
        }
      } else {
        setCurrentPitch('Rest / Silent');
      }
    }

    animationFrameRef.current = requestAnimationFrame(trackPitch);
  };

  const calculateSingingAccuracy = () => {
    if (pitchHistory.length === 0) {
      setAccuracy(0);
      setHasSung(true);
      return;
    }

    // Accuracy is calculated by looking at pitch discrepancies.
    // We allow a tolerance of +/- 1 semitone for beginners/singing pitch shifts.
    let matchedFrames = 0;
    pitchHistory.forEach((frame) => {
      const distance = Math.abs(frame.sung - frame.target);
      if (distance <= 1) {
        matchedFrames++;
      }
    });

    const acc = Math.round((matchedFrames / pitchHistory.length) * 100);
    setAccuracy(acc);
    setHasSung(true);
    onAddScore(acc);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="glass-card rounded-3xl p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>🎤</span> Sight Singing Mode
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Read the notation, sing into your microphone, and verify pitch accuracy.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={playTargetMelody}
              className="glass-button-secondary gap-1.5 text-xs py-2 px-3.5 h-10 rounded-xl"
            >
              <Volume2 className="w-4 h-4" /> Listen to Melody
            </button>
            <button
              onClick={handleGenerate}
              className="glass-button-secondary w-10 h-10 rounded-xl !p-0"
              title="New Exercise"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sheet Music Rendering */}
        <div className="mb-6">
          <SheetMusic notes={notes} timeSignature={timeSignature} activeNoteIndex={activeNoteIndex} />
        </div>

        {/* Recording Flow / Controls */}
        <div className="flex flex-col items-center justify-center p-6 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 rounded-3xl relative">
          {countdown !== null && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center text-white z-10">
              <span className="text-5xl font-bold font-display animate-ping">{countdown}</span>
              <p className="text-xs font-semibold text-slate-400 mt-4 tracking-wider uppercase">Prepare to Sing!</p>
            </div>
          )}

          {isRecording ? (
            <div className="text-center space-y-3">
              <button
                onClick={() => stopRecording(true)}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/20 animate-pulse active:scale-95 transition-all mx-auto"
              >
                <MicOff className="w-6 h-6" />
              </button>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest">RECORDING ACTIVE</p>
                <div className="mt-2 text-sm text-slate-600 dark:text-slate-300 font-mono">
                  Target Note: <span className="font-bold text-music-600 dark:text-music-400">{targetPitchText}</span>
                  {currentPitch && (
                    <span className="ml-3">
                      Sung: <span className="font-bold text-accent-600 dark:text-accent-400">{currentPitch}</span> ({Math.round(currentFreq)} Hz)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <button
                onClick={startRecordingFlow}
                className="w-16 h-16 rounded-full bg-gradient-to-tr from-music-600 to-accent-600 hover:from-music-500 hover:to-accent-500 text-white flex items-center justify-center shadow-lg shadow-music-500/20 active:scale-95 transition-all mx-auto"
              >
                <Mic className="w-6 h-6" />
              </button>
              <div>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Ready to Capture
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  Click the microphone, wait for the countdown, and sing the notes in rhythm.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Results Panel */}
        {hasSung && accuracy !== null && (
          <div className="mt-6 p-5 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-music-500/10 flex items-center justify-center text-music-600 dark:text-music-400">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-base">Singing Report</h4>
                  <p className="text-xs text-slate-500">How close your frequencies matched the notation.</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-display text-music-600 dark:text-music-400">
                  {accuracy}%
                </span>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase">ACCURACY</span>
              </div>
            </div>

            {/* Performance pitch trace graph */}
            {pitchHistory.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Pitch Matching Map (Midi Scale)
                </span>
                <div className="h-40 w-full flex items-end justify-between border-b border-l border-slate-200 dark:border-slate-800 pb-1 pl-1 bg-white dark:bg-slate-950 rounded-xl p-2 overflow-x-auto">
                  <div className="flex items-end justify-around w-full h-full min-w-[300px]">
                    {pitchHistory.map((pt, index) => {
                      const maxVal = 72; // C5 is midi 72
                      const minVal = 57; // A3 is midi 57
                      const diff = maxVal - minVal;
                      
                      const targetPct = ((pt.target - minVal) / diff) * 100;
                      const sungPct = ((pt.sung - minVal) / diff) * 100;

                      return (
                        <div key={index} className="h-full w-2.5 relative flex flex-col justify-end">
                          {/* target indicator dot */}
                          <div
                            style={{ bottom: `${targetPct}%` }}
                            className="absolute w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 left-0.5"
                            title="Target Pitch"
                          />
                          {/* user sung indicator dot */}
                          <div
                            style={{ bottom: `${sungPct}%` }}
                            className={`absolute w-2.5 h-2.5 rounded-full left-0.5 border ${
                              Math.abs(pt.sung - pt.target) <= 1
                                ? 'bg-green-500 border-green-300'
                                : 'bg-red-500 border-red-300'
                            }`}
                            title="Your Pitch"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Start</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-350"></span> Target Note</span>
                  <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Matching Note</span>
                  <span>End</span>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
export default SightSinging;
