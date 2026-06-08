import { Note } from '../types';
import { BEAT_MAP } from './AudioEngine';

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function getMidiPitch(pitch: string): number {
  const match = pitch.match(/^([A-G])(#|b)?(\d)$/i);
  if (!match) return 60; // default middle C

  const [, letter, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  let noteIndex = CHROMATIC_NOTES.indexOf(letter.toUpperCase());
  
  if (accidental === '#') {
    noteIndex += 1;
  } else if (accidental === 'b') {
    noteIndex -= 1;
  }

  return 12 * (octave + 1) + noteIndex;
}

function toVariableLengthQuantity(value: number): number[] {
  const bytes: number[] = [];
  let buffer = value;
  
  bytes.push(buffer & 0x7F);
  buffer >>= 7;

  while (buffer > 0) {
    bytes.push((buffer & 0x7F) | 0x80);
    buffer >>= 7;
  }

  return bytes.reverse();
}

export function exportToMidi(notes: Note[], title: string = 'Melody_Trainer_Exercise') {
  const TICKS_PER_BEAT = 480; 

  const header = [
    0x4D, 0x54, 0x68, 0x64, 
    0x00, 0x00, 0x00, 0x06, 
    0x00, 0x00,             
    0x00, 0x01,             
    (TICKS_PER_BEAT >> 8) & 0xFF, TICKS_PER_BEAT & 0xFF 
  ];

  let trackData: number[] = [];

  const trackNameBytes = new TextEncoder().encode(title);
  trackData.push(
    0x00, 0xFF, 0x03, 
    ...toVariableLengthQuantity(trackNameBytes.length),
    ...Array.from(trackNameBytes)
  );

  trackData.push(
    0x00, 0xFF, 0x51, 0x03, 
    0x09, 0x27, 0xC0
  );

  let accumulatedDelta = 0;

  notes.forEach((note) => {
    const ticks = BEAT_MAP[note.duration] * TICKS_PER_BEAT;

    if (note.type === 'rest' || note.pitch === 'R') {
      accumulatedDelta += ticks;
    } else {
      const midiNote = getMidiPitch(note.pitch);

      trackData.push(
        ...toVariableLengthQuantity(accumulatedDelta),
        0x90, 
        midiNote,
        0x64  
      );

      accumulatedDelta = 0;

      trackData.push(
        ...toVariableLengthQuantity(ticks),
        0x80, 
        midiNote,
        0x40  
      );
    }
  });

  trackData.push(
    0x00, 0xFF, 0x2F, 0x00 
  );

  const trackHeader = [
    0x4D, 0x54, 0x72, 0x6B, 
    (trackData.length >> 24) & 0xFF,
    (trackData.length >> 16) & 0xFF,
    (trackData.length >> 8) & 0xFF,
    trackData.length & 0xFF
  ];

  const fullMidi = new Uint8Array([...header, ...trackHeader, ...trackData]);

  const blob = new Blob([fullMidi], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
