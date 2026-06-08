import React, { useState, useEffect } from 'react';
import { Note, TimeSignature, Difficulty, InstrumentType, CustomExercise } from '../types';
import { SheetMusic } from './SheetMusic';
import { exportToMidi } from '../utils/midi';
import { exportToMusicXml } from '../utils/musicxml';
import { Plus, Trash2, Link, FileText, Play, Save, CheckCircle2, Copy } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const TeacherMode: React.FC = () => {
  const [exercises, setExercises] = useState<CustomExercise[]>(() => {
    const saved = localStorage.getItem('teacher_exercises');
    return saved ? JSON.parse(saved) : [];
  });

  // Editor States
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [tempo, setTempo] = useState(100);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>('4/4');
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  
  // Custom Notes list being built
  const [notes, setNotes] = useState<Note[]>([]);
  const [newPitch, setNewPitch] = useState('C4');
  const [newDuration, setNewDuration] = useState<Note['duration']>('q');
  const [isRest, setIsRest] = useState(false);

  const [shareLink, setShareLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState<number | null>(null);

  useEffect(() => {
    localStorage.setItem('teacher_exercises', JSON.stringify(exercises));
  }, [exercises]);

  const handleAddNote = () => {
    const note: Note = {
      pitch: isRest ? 'R' : newPitch,
      duration: newDuration,
      type: isRest ? 'rest' : 'note',
      isDotted: newDuration.endsWith('d'),
    };
    setNotes([...notes, note]);
  };

  const handleRemoveNote = (idx: number) => {
    setNotes(notes.filter((_, i) => i !== idx));
  };

  const handleClearNotes = () => {
    setNotes([]);
  };

  const handleSaveExercise = () => {
    if (!title) {
      alert('Please enter an exercise title.');
      return;
    }

    const newEx: CustomExercise = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description: desc,
      tempo,
      timeSignature,
      difficulty,
      instrument,
      notes,
    };

    setExercises([newEx, ...exercises]);
    
    // Clear editor
    setTitle('');
    setDesc('');
    setNotes([]);
  };

  const handleDeleteExercise = (id: string) => {
    setExercises(exercises.filter((ex) => ex.id !== id));
  };

  const handleGenerateShareLink = (ex: CustomExercise) => {
    // Compress exercise state into Base64 JSON
    try {
      const json = JSON.stringify(ex);
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const url = `${window.location.origin}${window.location.pathname}?exercise=${b64}`;
      setShareLink(url);
      setLinkCopied(false);
    } catch (e) {
      alert('Failed to generate share link.');
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleExportPDF = async (ex: CustomExercise) => {
    const element = document.getElementById(`pdf-sheet-${ex.id}`);
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Keep margin and adjust width
      const imgWidth = pdfWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.text('Melody Ear Trainer Pro - Custom Exercise', 20, 30);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Title: ${ex.title}`, 20, 50);
      pdf.text(`Description: ${ex.description}`, 20, 65);
      pdf.text(`Tempo: ${ex.tempo} BPM  |  Meter: ${ex.timeSignature}  |  Difficulty: ${ex.difficulty.toUpperCase()}`, 20, 80);

      // Add notation image canvas
      pdf.addImage(imgData, 'PNG', 20, 100, imgWidth, imgHeight);
      
      pdf.save(`${ex.title.replace(/\s+/g, '_')}_exercise.pdf`);
    } catch (e) {
      alert('PDF generation failed. Check browser print extensions.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Editor Panel */}
        <div className="lg:col-span-1 glass-card rounded-3xl p-6 space-y-4">
          <h3 className="font-display font-bold text-lg text-slate-800 dark:text-slate-100 border-b border-slate-200/50 dark:border-slate-800/50 pb-3">
            Exercise Editor
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Exercise Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="E.g., C Major Stepwise Drill 1"
              className="w-full glass-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Instructions for your students..."
              className="w-full glass-input text-xs h-16 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tempo (BPM)</label>
              <input
                type="number"
                value={tempo}
                onChange={(e) => setTempo(parseInt(e.target.value, 10))}
                className="w-full glass-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Time Signature</label>
              <select
                value={timeSignature}
                onChange={(e) => setTimeSignature(e.target.value as TimeSignature)}
                className="w-full glass-input text-xs h-9.5"
              >
                <option value="2/4">2/4</option>
                <option value="3/4">3/4</option>
                <option value="4/4">4/4</option>
                <option value="5/4">5/4</option>
                <option value="6/8">6/8</option>
              </select>
            </div>
          </div>

          <div className="border border-slate-150 dark:border-slate-800/80 p-3 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
            <h4 className="text-xs font-bold text-slate-500">Add Notes</h4>
            
            <div className="flex gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                <input
                  type="checkbox"
                  checked={isRest}
                  onChange={(e) => setIsRest(e.target.checked)}
                  className="rounded text-music-600"
                />
                <span>Is Rest</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {!isRest && (
                <div>
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">Pitch</label>
                  <select
                    value={newPitch}
                    onChange={(e) => setNewPitch(e.target.value)}
                    className="w-full glass-input text-[11px] py-1 h-8"
                  >
                    {['C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4', 'C5', 'D5', 'E5'].map(
                      (p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      )
                    )}
                  </select>
                </div>
              )}
              <div className={isRest ? 'col-span-2' : ''}>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Duration</label>
                <select
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value as Note['duration'])}
                  className="w-full glass-input text-[11px] py-1 h-8"
                >
                  <option value="w">Whole Note (4b)</option>
                  <option value="h">Half Note (2b)</option>
                  <option value="q">Quarter Note (1b)</option>
                  <option value="8">Eighth Note (0.5b)</option>
                  <option value="16">16th Note (0.25b)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAddNote}
              className="w-full glass-button-primary text-xs py-2 gap-1 rounded-xl shadow-none"
            >
              <Plus className="w-4 h-4" /> Insert Note
            </button>
          </div>

          <button
            onClick={handleSaveExercise}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-xl font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Save Custom Exercise
          </button>
        </div>

        {/* Live Preview and Lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notes Preview Queue */}
          <div className="glass-card rounded-3xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display font-bold text-base">Current Construction Sheet</h3>
              {notes.length > 0 && (
                <button
                  onClick={handleClearNotes}
                  className="text-xs font-semibold text-red-500 hover:underline"
                >
                  Clear All
                </button>
              )}
            </div>
            {notes.length > 0 ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-1.5 p-3 border border-slate-100 dark:border-slate-800/80 rounded-2xl bg-white dark:bg-slate-950 max-h-32 overflow-y-auto">
                  {notes.map((note, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 py-1 px-2.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300"
                    >
                      {note.type === 'rest' ? 'R' : note.pitch} ({note.duration})
                      <button
                        onClick={() => handleRemoveNote(idx)}
                        className="text-red-500 hover:text-red-700 font-bold"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <SheetMusic notes={notes} timeSignature={timeSignature} activeNoteIndex={null} />
              </div>
            ) : (
              <div className="h-40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-900/30">
                <Plus className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs font-semibold text-slate-400">Construction board is empty</p>
                <p className="text-[10px] text-slate-450 mt-1 max-w-xs">
                  Fill in title/tempo details and add individual notes using the builder sidebar to engrave standard sheets.
                </p>
              </div>
            )}
          </div>

          {/* Share Link Dialog Box */}
          {shareLink && (
            <div className="p-4 rounded-2xl bg-music-500/10 border border-music-300 flex items-center justify-between gap-4 animate-pulse-slow">
              <div className="overflow-hidden pr-2">
                <span className="text-[10px] font-bold text-music-600 block uppercase">Shareable student URL</span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate font-mono mt-0.5">{shareLink}</p>
              </div>
              <button
                onClick={copyShareLink}
                className="glass-button-primary shrink-0 text-xs py-2 px-3 flex items-center gap-1"
              >
                {linkCopied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Link
                  </>
                )}
              </button>
            </div>
          )}

          {/* Saved Custom Exercises */}
          <div className="glass-card rounded-3xl p-6">
            <h3 className="font-display font-bold text-base mb-4">Saved Teacher Exercises ({exercises.length})</h3>
            
            {exercises.length > 0 ? (
              <div className="space-y-4">
                {exercises.map((ex) => (
                  <div
                    key={ex.id}
                    id={`pdf-sheet-${ex.id}`}
                    className="p-4 border border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-950 flex flex-col gap-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">{ex.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{ex.description}</p>
                        <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                          Tempo: {ex.tempo} BPM | Meter: {ex.timeSignature}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleGenerateShareLink(ex)}
                          className="glass-button-secondary w-8 h-8 rounded-lg !p-0"
                          title="Generate Share Link"
                        >
                          <Link className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleExportPDF(ex)}
                          className="glass-button-secondary w-8 h-8 rounded-lg !p-0"
                          title="Export as PDF"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteExercise(ex.id)}
                          className="glass-button-secondary w-8 h-8 rounded-lg !p-0 text-red-500 border-red-500/10 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <SheetMusic notes={ex.notes} timeSignature={ex.timeSignature} activeNoteIndex={null} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">No custom exercises saved yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
export default TeacherMode;
