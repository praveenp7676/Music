import * as Tone from 'tone';
import { InstrumentType, Note, NoteDuration } from '../types';

// Duration mappings to Tone.js time notation
export const DURATION_MAP: Record<NoteDuration, string> = {
  'w': '1n',
  'h': '2n',
  'q': '4n',
  '8': '8n',
  '16': '16n',
  'wd': '1n.',
  'hd': '2n.',
  'qd': '4n.',
  '8d': '8n.',
  '16d': '16n.',
};

// Duration mapping to number of beats
export const BEAT_MAP: Record<NoteDuration, number> = {
  'w': 4,
  'h': 2,
  'q': 1,
  '8': 0.5,
  '16': 0.25,
  'wd': 6,
  'hd': 3,
  'qd': 1.5,
  '8d': 0.75,
  '16d': 0.375,
};

class AudioEngine {
  private synth: any = null;
  private backingSynth: any = null;
  private currentInstrument: InstrumentType = 'piano';
  private bpm: number = 100;
  private activeSequence: Tone.Part | null = null;
  private playbackRate: number = 1.0;
  private samplerUrls: Record<InstrumentType, Record<string, string>> = {
    piano: {
      'C4': 'C4.mp3',
      'D#4': 'Ds4.mp3',
      'F#4': 'Fs4.mp3',
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
    },
    violin: {
      'A4': 'A4.mp3',
      'C5': 'C5.mp3',
      'E5': 'E5.mp3',
      'G4': 'G4.mp3',
    },
    flute: {
      'C4': 'C4.mp3',
      'G4': 'G4.mp3',
      'C5': 'C5.mp3',
      'G5': 'G5.mp3',
    },
    guitar: {
      'E2': 'E2.mp3',
      'A2': 'A2.mp3',
      'D3': 'D3.mp3',
      'G3': 'G3.mp3',
      'B3': 'B3.mp3',
      'E4': 'E4.mp3',
    },
    synth: {} // Handled via standard Synth
  };

  constructor() {
    // Lazy initialisation of default instrument happens on first play to respect browser policy
  }

  private initSynth(type: InstrumentType) {
    if (this.synth) {
      this.synth.dispose();
    }
    if (this.backingSynth) {
      this.backingSynth.dispose();
      this.backingSynth = null;
    }

    const volume = new Tone.Volume(-6).toDestination();

    switch (type) {
      case 'piano':
        // High quality physical synth model of piano with audible harmonics in lower registers
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.005,
            decay: 1.4,
            sustain: 0.15,
            release: 1.5,
          },
        }).connect(volume);
        break;

      case 'violin':
        // Bowed instrument approximation with slow attack and vibrato
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: {
            attack: 0.15,
            decay: 0.5,
            sustain: 0.8,
            release: 0.5,
          },
        }).connect(volume);
        // Add a gentle vibrato effect
        const vibrato = new Tone.Vibrato(5, 0.15).toDestination();
        this.synth.connect(vibrato);
        break;

      case 'flute':
        // Soft breathy flute approximation
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.08,
            decay: 0.2,
            sustain: 0.9,
            release: 0.3,
          },
        }).connect(volume);
        const fluteVibrato = new Tone.Vibrato(6, 0.1).toDestination();
        this.synth.connect(fluteVibrato);
        break;

      case 'guitar':
        // Plucked nylon guitar approximation
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.002,
            decay: 1.5,
            sustain: 0.0,
            release: 0.8,
          },
        }).connect(volume);
        break;

      case 'synth':
      default:
        // Classic rich synthesizer
        this.synth = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sawtooth' },
          envelope: {
            attack: 0.05,
            decay: 0.2,
            sustain: 0.6,
            release: 0.8,
          },
        }).connect(volume);
        break;
    }

    this.currentInstrument = type;
  }

  public async setInstrument(type: InstrumentType): Promise<void> {
    await Tone.start();
    this.initSynth(type);
  }

  public setTempo(bpm: number) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = this.bpm * this.playbackRate;
  }

  public setPlaybackSpeed(factor: number) {
    this.playbackRate = factor;
    Tone.Transport.bpm.value = this.bpm * this.playbackRate;
  }

  public async playNote(pitch: string, duration: NoteDuration, time?: number) {
    await Tone.start();
    if (!this.synth) {
      this.initSynth(this.currentInstrument);
    }
    const toneDuration = DURATION_MAP[duration];
    if (pitch !== 'R' && this.synth) {
      if (time !== undefined) {
        this.synth.triggerAttackRelease(pitch, toneDuration, time);
      } else {
        this.synth.triggerAttackRelease(pitch, toneDuration);
      }
    }
  }

  public async playChord(pitches: string[], duration: NoteDuration = 'h') {
    await Tone.start();
    if (!this.synth) {
      this.initSynth(this.currentInstrument);
    }
    const toneDuration = DURATION_MAP[duration];
    if (this.synth) {
      this.synth.triggerAttackRelease(pitches, toneDuration);
    }
  }

  public async playMelody(
    notes: Note[],
    onNoteStart?: (index: number) => void,
    onComplete?: () => void,
    isCallAndResponse: boolean = false
  ) {
    await Tone.start();
    this.stop();

    if (!this.synth) {
      this.initSynth(this.currentInstrument);
    }

    Tone.Transport.bpm.value = this.bpm * this.playbackRate;

    // Convert notes into events with exact times
    let currentTime = 0;
    const events: Array<{ time: number; note: Note; index: number }> = [];

    notes.forEach((note, index) => {
      events.push({
        time: currentTime,
        note: note,
        index: index
      });
      // Increment elapsed time by beat count
      currentTime += BEAT_MAP[note.duration];
    });

    const totalDuration = currentTime;

    // Call and response: duplicate events after a pause
    let playbackEvents = [...events];
    if (isCallAndResponse) {
      const responseDelay = totalDuration + 2; // 2 beats pause
      events.forEach((event) => {
        playbackEvents.push({
          time: event.time + responseDelay,
          note: event.note,
          index: event.index + notes.length // distinguishable index
        });
      });
    }

    // Schedule sequence using Tone.Part
    this.activeSequence = new Tone.Part(
      (time, event: any) => {
        const { note, index } = event.value;
        const normalizedIndex = index % notes.length;
        
        // Trigger highlight callback
        if (onNoteStart) {
          Tone.Draw.schedule(() => {
            onNoteStart(normalizedIndex);
          }, time);
        }

        // Play note if it's not a rest
        if (note.type !== 'rest' && note.pitch !== 'R' && this.synth) {
          const toneDuration = DURATION_MAP[note.duration as NoteDuration];
          this.synth.triggerAttackRelease(note.pitch, toneDuration, time);
        }
      },
      playbackEvents.map((evt) => ({ time: evt.time, value: evt }))
    );

    this.activeSequence.start(0);
    Tone.Transport.start();

    // Schedule completion callback
    const finalTime = isCallAndResponse ? (totalDuration * 2 + 2) : totalDuration;
    Tone.Transport.scheduleOnce((time) => {
      this.stop();
      if (onComplete) {
        Tone.Draw.schedule(() => {
          onComplete();
        }, time);
      }
    }, finalTime);
  }

  public async playMelodyWithChords(
    notes: Note[],
    measureChords: string[][],
    beatsPerBar: number = 4,
    onNoteStart?: (index: number) => void,
    onComplete?: () => void
  ) {
    await Tone.start();
    this.stop();

    if (!this.synth) {
      this.initSynth(this.currentInstrument);
    }

    if (!this.backingSynth) {
      const backingVolume = new Tone.Volume(-14).toDestination();
      this.backingSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.05,
          decay: 1.5,
          sustain: 0.4,
          release: 2.0,
        },
      }).connect(backingVolume);
    }

    Tone.Transport.bpm.value = this.bpm * this.playbackRate;

    let currentTime = 0;
    const events: Array<{ time: number; note: Note; index: number; isChord: false }> = [];

    notes.forEach((note, index) => {
      events.push({
        time: currentTime,
        note: note,
        index: index,
        isChord: false,
      });
      currentTime += BEAT_MAP[note.duration];
    });

    const chordEvents: Array<{ time: number; pitches: string[]; duration: string; isChord: true }> = [];
    measureChords.forEach((pitches, index) => {
      if (pitches && pitches.length > 0) {
        chordEvents.push({
          time: index * beatsPerBar,
          pitches: pitches,
          duration: `${beatsPerBar}n`,
          isChord: true,
        });
      }
    });

    const allEvents = [
      ...events.map(e => ({ time: e.time, value: e })),
      ...chordEvents.map(e => ({ time: e.time, value: e }))
    ];

    this.activeSequence = new Tone.Part(
      (time, event: any) => {
        const val = event.value;
        if (val.isChord) {
          if (this.backingSynth && val.pitches.length > 0) {
            this.backingSynth.triggerAttackRelease(val.pitches, '2n', time);
          }
        } else {
          const { note, index } = val;
          if (onNoteStart) {
            Tone.Draw.schedule(() => {
              onNoteStart(index);
            }, time);
          }
          if (note.type !== 'rest' && note.pitch !== 'R' && this.synth) {
            const toneDuration = DURATION_MAP[note.duration as NoteDuration];
            this.synth.triggerAttackRelease(note.pitch, toneDuration, time);
          }
        }
      },
      allEvents
    );

    this.activeSequence.start(0);
    Tone.Transport.start();

    const totalDuration = Math.max(currentTime, measureChords.length * beatsPerBar);

    Tone.Transport.scheduleOnce((time) => {
      this.stop();
      if (onComplete) {
        Tone.Draw.schedule(() => {
          onComplete();
        }, time);
      }
    }, totalDuration);
  }

  public stop() {
    Tone.Transport.stop();
    // Clear all scheduled events
    Tone.Transport.cancel();
    if (this.activeSequence) {
      this.activeSequence.dispose();
      this.activeSequence = null;
    }
  }

  public isPlaying(): boolean {
    return Tone.Transport.state === 'started';
  }
}

export const audioEngine = new AudioEngine();
