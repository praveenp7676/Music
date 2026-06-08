import React, { useState, useEffect } from 'react';
import { CARNATIC_RAGAS, generateCarnaticLesson, pitchToSwara } from '../utils/carnaticGen';
import { Note } from '../types';
import { SheetMusic } from './SheetMusic';
import { audioEngine } from '../utils/AudioEngine';
import { Play, Square, RefreshCw, Volume2, Award, Info } from 'lucide-react';

export const CarnaticMode: React.FC = () => {
  const [selectedRaga, setSelectedRaga] = useState('Mayamalavagowla');
  const [lessonType, setLessonType] = useState<'sarali' | 'janta' | 'alankara' | 'geetham'>('sarali');
  const [lessonNumber, setLessonNumber] = useState(1);
  const [tempo, setTempo] = useState(120);

  const [notes, setNotes] = useState<Note[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);

  const ragaInfo = CARNATIC_RAGAS[selectedRaga];

  useEffect(() => {
    handleLoadLesson();
  }, [selectedRaga, lessonType, lessonNumber]);

  const handleLoadLesson = () => {
    audioEngine.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);

    const generated = generateCarnaticLesson(lessonType, selectedRaga, lessonNumber);
    setNotes(generated);
  };

  const playLesson = () => {
    if (isPlaying) {
      audioEngine.stop();
      setIsPlaying(false);
      setActiveNoteIndex(null);
      return;
    }

    setIsPlaying(true);
    audioEngine.setTempo(tempo);
    audioEngine.setInstrument('flute'); // flute is very standard for Carnatic playbacks
    audioEngine.playMelody(
      notes,
      (idx) => {
        setActiveNoteIndex(idx);
      },
      () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
      }
    );
  };

  const playSingleSwara = async (index: number) => {
    audioEngine.stop();
    // Play swara pitch from scale
    const pitch = ragaInfo.notes[index];
    audioEngine.setInstrument('synth'); // clear clean sound for single note trigger
    await audioEngine.playNote(pitch, 'q');
  };

  return (
    <div className="space-y-6">
      {/* Raga Details and info */}
      <div className="glass-card rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Select Raga</label>
          <select
            value={selectedRaga}
            onChange={(e) => setSelectedRaga(e.target.value)}
            className="w-full glass-input text-sm h-11"
          >
            {Object.keys(CARNATIC_RAGAS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-450 dark:text-slate-500">
            <Info className="w-3.5 h-3.5" />
            <span>Melakarta Raganga System</span>
          </div>
        </div>

        {/* Melakarta info card */}
        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl p-4 md:col-span-2 space-y-2">
          <div className="flex justify-between items-center border-b border-slate-200/55 dark:border-slate-800/55 pb-1.5">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 font-display">
              {ragaInfo.name} Raga
            </span>
            {ragaInfo.melakarta && (
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-accent-500/15 text-accent-600">
                Melakarta #{ragaInfo.melakarta}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[9px] uppercase tracking-widest">Arohana (Rising)</span>
              <span className="font-bold font-mono text-slate-650 dark:text-slate-350">
                {ragaInfo.arohana.join(' ')}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[9px] uppercase tracking-widest">Avarohana (Falling)</span>
              <span className="font-bold font-mono text-slate-650 dark:text-slate-350">
                {ragaInfo.avarohana.join(' ')}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* Swara Keyboard/Pads */}
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display font-bold text-sm text-slate-500 uppercase tracking-widest mb-4">
          Interactive Swarasthana Touchpad
        </h3>
        <div className="grid grid-cols-7 gap-2">
          {['Sa', 'Ri', 'Ga', 'Ma', 'Pa', 'Da', 'Ni'].map((swara, index) => {
            const pitch = ragaInfo.notes[index];
            const pitchLetter = pitch.replace(/\d+$/, '');
            return (
              <button
                key={swara}
                onClick={() => playSingleSwara(index)}
                className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-music-500 hover:bg-music-500/5 active:scale-95 transition-all text-center"
              >
                <span className="text-lg font-black font-display text-music-600 dark:text-music-400">{swara}</span>
                <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 mt-1">{pitchLetter}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lesson View Section */}
      <div className="glass-card rounded-3xl p-6 space-y-6">
        
        {/* Lesson Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
          <div className="flex flex-wrap gap-1">
            {(['sarali', 'janta', 'alankara', 'geetham'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setLessonType(tab);
                  setLessonNumber(1);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                  lessonType === tab
                    ? 'bg-music-600 text-white shadow-md shadow-music-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-650 dark:text-slate-350'
                }`}
              >
                {tab} Varisai
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {lessonType === 'sarali' && (
              <div className="flex gap-1">
                {[1, 2, 3].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLessonNumber(num)}
                    className={`w-7 h-7 text-xs font-bold rounded-lg ${
                      lessonNumber === num ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}
            {lessonType === 'janta' && (
              <div className="flex gap-1">
                {[1, 2].map((num) => (
                  <button
                    key={num}
                    onClick={() => setLessonNumber(num)}
                    className={`w-7 h-7 text-xs font-bold rounded-lg ${
                      lessonNumber === num ? 'bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}
            
            <button
              onClick={playLesson}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white active:scale-95 transition-all ${
                isPlaying ? 'bg-red-500' : 'bg-music-600 hover:bg-music-500'
              }`}
            >
              {isPlaying ? <Square className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white translate-x-0.5" />}
            </button>
          </div>
        </div>

        {/* Notation Sheet */}
        <SheetMusic notes={notes} timeSignature="4/4" activeNoteIndex={activeNoteIndex} />

        {/* Swara Lyrics Display (Underneath) */}
        <div className="p-4 border border-slate-100 dark:border-slate-800/80 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2.5">
            Swara Lyrics Sequence
          </span>
          <div className="flex flex-wrap gap-y-3 gap-x-6 text-sm md:text-base font-bold text-slate-700 dark:text-slate-350">
            {notes.map((note, idx) => {
              const isCurrent = idx === activeNoteIndex;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <span className={`transition-all duration-100 ${isCurrent ? 'text-music-500 scale-125 font-black' : ''}`}>
                    {note.swara || 'Sa'}
                  </span>
                  <span className="text-[9px] font-normal text-slate-400 font-mono mt-0.5 capitalize">
                    {note.duration === 'h' ? '2b' : '1b'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
export default CarnaticMode;
