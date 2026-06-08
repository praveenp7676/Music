const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Autocorrelation algorithm (YIN-like simple autocorrelation)
 * to find the fundamental frequency of an audio buffer.
 */
export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const bufferSize = buffer.length;
  
  // Calculate root-mean-square (RMS) amplitude to ensure there is enough sound
  let rms = 0;
  for (let i = 0; i < bufferSize; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / bufferSize);
  
  // If the signal is too quiet, do not attempt pitch detection
  if (rms < 0.01) {
    return -1;
  }

  // Trim silence at start and end (simple noise gate)
  let r1 = 0;
  let r2 = bufferSize - 1;
  const thres = 0.002;
  for (let i = 0; i < bufferSize / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
    } else {
      break;
    }
  }
  for (let i = bufferSize - 1; i >= bufferSize / 2; i--) {
    if (Math.abs(buffer[i]) < thres) {
      r2 = i;
    } else {
      break;
    }
  }
  
  const signal = buffer.subarray(r1, r2);
  const signalSize = signal.length;
  
  if (signalSize < 64) {
    return -1; // Not enough samples
  }

  // Calculate Autocorrelation
  const c = new Float32Array(signalSize);
  for (let i = 0; i < signalSize; i++) {
    for (let j = 0; j < signalSize - i; j++) {
      c[i] = c[i] + signal[j] * signal[j + i];
    }
  }

  // Find the first zero-crossing to skip the central peak
  let d = 0;
  while (d < signalSize - 1 && c[d] > 0) {
    d++;
  }

  // Find the absolute highest peak after the zero-crossing
  let maxVal = -1;
  let maxPos = -1;
  for (let i = d; i < signalSize; i++) {
    if (c[i] > maxVal) {
      maxVal = c[i];
      maxPos = i;
    }
  }

  let T0 = maxPos;

  // Parabolic interpolation for sub-sample accuracy
  if (T0 > 0 && T0 < signalSize - 1) {
    const alpha = c[T0 - 1];
    const beta = c[T0];
    const gamma = c[T0 + 1];
    const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
    T0 = T0 + p;
  }

  const frequency = sampleRate / T0;

  // Limit frequency to human singing range (approx. 50Hz to 1600Hz)
  if (frequency > 50 && frequency < 1600) {
    return frequency;
  }

  return -1;
}

interface PitchDetails {
  note: string;
  cents: number;
  frequency: number;
}

/**
 * Converts frequency in Hz to Note name, Octave, and cents offset.
 */
export function frequencyToPitch(frequency: number): PitchDetails | null {
  if (frequency <= 0 || isNaN(frequency)) return null;

  // A4 = 440Hz is MIDI key 69
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2)) + 69;
  const roundedNoteNum = Math.round(noteNum);
  const cents = Math.round((noteNum - roundedNoteNum) * 100);

  const midiNote = Math.max(0, Math.min(127, roundedNoteNum));
  const noteName = CHROMATIC_NOTES[midiNote % 12];
  const octave = Math.floor(midiNote / 12) - 1;

  return {
    note: `${noteName}${octave}`,
    cents,
    frequency,
  };
}

/**
 * Calculates semitone distance between two pitches.
 * E.g., distance between 'C4' and 'D4' is 2.
 */
export function getPitchDistance(p1: string, p2: string): number {
  const getMidiValue = (pitch: string): number => {
    const match = pitch.match(/^([A-G]#?|Bb?)(\d)$/i);
    if (!match) return 60; // Default C4
    const [, name, octStr] = match;
    const octave = parseInt(octStr, 10);
    let nameIdx = CHROMATIC_NOTES.indexOf(name.toUpperCase());
    if (nameIdx === -1) {
      if (name.toUpperCase() === 'BB') nameIdx = 10;
      else nameIdx = 0;
    }
    return nameIdx + (octave + 1) * 12;
  };

  return Math.abs(getMidiValue(p1) - getMidiValue(p2));
}
