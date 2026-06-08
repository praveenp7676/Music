import React, { useEffect, useRef } from 'react';
import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Beam, Dot } from 'vexflow';
import { Note, TimeSignature } from '../types';
import { BEAT_MAP } from '../utils/AudioEngine';

interface SheetMusicProps {
  notes: Note[];
  timeSignature: TimeSignature;
  activeNoteIndex: number | null;
}

export const SheetMusic: React.FC<SheetMusicProps> = ({
  notes,
  timeSignature,
  activeNoteIndex,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper to map our note representation to VexFlow keys and durations
  const parseNoteToVexFlow = (note: Note, isFirstNoteInMeasure: boolean): { keys: string[]; duration: string; accidentals: string[] } => {
    if (note.type === 'rest' || note.pitch === 'R') {
      const vexDuration = note.duration + 'r';
      return {
        keys: ['b/4'], // Middle line for rests
        duration: vexDuration,
        accidentals: [],
      };
    }

    // Convert e.g., 'C#4' to 'c#/4', 'Bb5' to 'bb/5'
    const match = note.pitch.match(/^([A-G])(#|b)?(\d)$/i);
    if (!match) {
      return { keys: ['b/4'], duration: 'qr', accidentals: [] };
    }

    const [, letter, accidental, octave] = match;
    const key = `${letter.toLowerCase()}${accidental || ''}/${octave}`;
    const accidentals: string[] = [];
    if (accidental) {
      accidentals.push(accidental);
    }

    return {
      keys: [key],
      duration: note.duration,
      accidentals,
    };
  };

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    // Clear previous drawing
    containerRef.current.innerHTML = '';

    // Parse the time signature
    const [numStr, denStr] = timeSignature.split('/');
    const beatsPerMeasure = parseInt(numStr, 10);
    const beatValue = parseInt(denStr, 10);
    const beatsPerBar = beatsPerMeasure * (4 / beatValue);

    // Group notes into measures
    const measures: Note[][] = [];
    let currentMeasure: Note[] = [];
    let accumBeats = 0;

    notes.forEach((note) => {
      const noteBeats = BEAT_MAP[note.duration];
      
      // Check if adding this note exceeds the bar capacity (with float precision buffer)
      if (accumBeats + noteBeats > beatsPerBar + 0.001) {
        if (currentMeasure.length > 0) {
          measures.push(currentMeasure);
        }
        currentMeasure = [note];
        accumBeats = noteBeats;
      } else {
        currentMeasure.push(note);
        accumBeats += noteBeats;
        
        // Exact measure boundary reached
        if (Math.abs(accumBeats - beatsPerBar) < 0.001) {
          measures.push(currentMeasure);
          currentMeasure = [];
          accumBeats = 0;
        }
      }
    });

    // Capture any leftover notes
    if (currentMeasure.length > 0) {
      measures.push(currentMeasure);
    }

    // Measure sizes
    const measureWidth = 230;
    const startOffset = 70; // extra space for Clef and Time Signature on first stave
    const totalWidth = startOffset + (measures.length * measureWidth);
    const height = 150;

    // Create the VexFlow renderer
    const renderer = new Renderer(containerRef.current, Renderer.Backends.SVG);
    renderer.resize(totalWidth, height);
    const context = renderer.getContext();
    context.setFont('Arial', 10);

    let currentX = 10;
    let absoluteNoteCounter = 0;

    measures.forEach((measureNotes, measureIdx) => {
      const isFirst = measureIdx === 0;
      const width = measureWidth + (isFirst ? startOffset : 0);

      // Create a stave
      const stave = new Stave(currentX, 20, width);
      
      // Draw details on first measure
      if (isFirst) {
        stave.addClef('treble');
        stave.addTimeSignature(timeSignature);
      }

      // Draw end barline for last stave, normal for others
      if (measureIdx === measures.length - 1) {
        stave.setEndBarType(2);
      }

      stave.setContext(context).draw();

      // Convert measure notes to StaveNotes
      const staveNotes: StaveNote[] = [];
      const noteIdxMapping: number[] = [];

      measureNotes.forEach((note) => {
        const vfNoteInfo = parseNoteToVexFlow(note, isFirst && staveNotes.length === 0);
        
        const staveNote = new StaveNote({
          keys: vfNoteInfo.keys,
          duration: vfNoteInfo.duration,
          clef: 'treble',
        });

        // Add accidental if present
        if (vfNoteInfo.accidentals.length > 0) {
          vfNoteInfo.accidentals.forEach((acc) => {
            staveNote.addModifier(new Accidental(acc), 0);
          });
        }

        // Add dot if duration is dotted
        if (note.duration.endsWith('d')) {
          staveNote.addModifier(new Dot(), 0);
        }

        // Highlight if this is the active note
        const isHighlight = absoluteNoteCounter === activeNoteIndex;
        if (isHighlight) {
          staveNote.setStyle({
            fillStyle: '#9333ea', // purple-600 accent color
            strokeStyle: '#9333ea',
          });
        } else {
          // Standard modern dark slate color for high contrast
          staveNote.setStyle({
            fillStyle: '#475569', // slate-600
            strokeStyle: '#475569',
          });
        }

        staveNotes.push(staveNote);
        noteIdxMapping.push(absoluteNoteCounter);
        absoluteNoteCounter++;
      });

      if (staveNotes.length > 0) {
        // Create a voice for this measure
        const voice = new Voice({
          num_beats: beatsPerMeasure,
          beat_value: beatValue,
        });

        // Disable strict verification temporarily to prevent minor rounding discrepancies
        voice.setStrict(false);
        voice.addTickables(staveNotes);

        // Create formatter and render
        new Formatter().joinVoices([voice]).format([voice], width - (isFirst ? startOffset + 20 : 20));
        voice.draw(context, stave);

        // Generate automatic beams for eighth and sixteenth notes
        try {
          const beams = Beam.generateBeams(staveNotes);
          beams.forEach((beam) => {
            beam.setStyle({
              fillStyle: '#475569',
              strokeStyle: '#475569',
            });
            beam.setContext(context).draw();
          });
        } catch (e) {
          // Fallback if beaming fails
        }
      }

      currentX += width;
    });

  }, [notes, timeSignature, activeNoteIndex]);

  return (
    <div className="w-full overflow-x-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-4 shadow-sm">
      <div className="flex justify-center min-w-max" ref={containerRef} />
    </div>
  );
};
