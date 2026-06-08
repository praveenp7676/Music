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

// Convert numbers to variable-length quantities (VLQ) for MIDI time
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
  const TICKS_PER_BEAT = 480; // 480 ticks = Quarter note

  // Header chunk
  const header = [
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // length of header (6 bytes)
    0x00, 0x00,             // format type 0 (single track)
    0x00, 0x01,             // 1 track
    (TICKS_PER_BEAT >> 8) & 0xFF, TICKS_PER_BEAT & 0xFF // division: ticks per quarter note
  ];

  // Track chunk data bytes
  let trackData: number[] = [];

  // Track Name meta event
  const trackNameBytes = new TextEncoder().encode(title);
  trackData.push(
    0x00, 0xFF, 0x03, // Delta time 0, Meta event, Track Name
    ...toVariableLengthQuantity(trackNameBytes.length),
    ...Array.from(trackNameBytes)
  );

  // Set Tempo (100 BPM by default, overridden by MIDI player import, but good to specify)
  // 100 BPM = 600,000 microseconds per beat (0x09 0x27 0xC0)
  trackData.push(
    0x00, 0xFF, 0x51, 0x03, // Delta, Meta, Tempo, 3 bytes len
    0x09, 0x27, 0xC0
  );

  let accumulatedDelta = 0;

  notes.forEach((note) => {
    const ticks = BEAT_MAP[note.duration] * TICKS_PER_BEAT;

    if (note.type === 'rest' || note.pitch === 'R') {
      // Accumulate rest ticks into delta time of the next note-on event
      accumulatedDelta += ticks;
    } else {
      const midiNote = getMidiPitch(note.pitch);

      // Note On
      trackData.push(
        ...toVariableLengthQuantity(accumulatedDelta),
        0x90, // Note On, Channel 0
        midiNote,
        0x64  // Velocity: 100
      );

      // Reset delta for note off which happens immediately after note length
      accumulatedDelta = 0;

      // Note Off
      trackData.push(
        ...toVariableLengthQuantity(ticks),
        0x80, // Note Off, Channel 0
        midiNote,
        0x40  // Velocity: 64
      );
    }
  });

  // End of Track meta event
  trackData.push(
    0x00, 0xFF, 0x2F, 0x00 // Delta time 0, End of Track
  );

  // Build Track Chunk
  const trackHeader = [
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    (trackData.length >> 24) & 0xFF,
    (trackData.length >> 16) & 0xFF,
    (trackData.length >> 8) & 0xFF,
    trackData.length & 0xFF
  ];

  const fullMidi = new Uint8Array([...header, ...trackHeader, ...trackData]);

  // Trigger browser download
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
export default exportToMidi;
