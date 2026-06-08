import { Note, CarnaticRaga, NoteDuration } from '../types';

export const CARNATIC_RAGAS: Record<string, CarnaticRaga> = {
  'Mayamalavagowla': {
    name: 'Mayamalavagowla',
    melakarta: 15,
    arohana: ['Sa', 'Ri1', 'Ga3', 'Ma1', 'Pa', 'Da1', 'Ni3', 'Sa'],
    avarohana: ['Sa', 'Ni3', 'Da1', 'Pa', 'Ma1', 'Ga3', 'Ri1', 'Sa'],
    notes: ['C4', 'Db4', 'E4', 'F4', 'G4', 'Ab4', 'B4', 'C5'],
  },
  'Sankarabharanam': {
    name: 'Sankarabharanam',
    melakarta: 29,
    arohana: ['Sa', 'Ri2', 'Ga3', 'Ma1', 'Pa', 'Da2', 'Ni3', 'Sa'],
    avarohana: ['Sa', 'Ni3', 'Da2', 'Pa', 'Ma1', 'Ga3', 'Ri2', 'Sa'],
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  },
  'Kalyani': {
    name: 'Kalyani',
    melakarta: 65,
    arohana: ['Sa', 'Ri2', 'Ga3', 'Ma2', 'Pa', 'Da2', 'Ni3', 'Sa'],
    avarohana: ['Sa', 'Ni3', 'Da2', 'Pa', 'Ma2', 'Ga3', 'Ri2', 'Sa'],
    notes: ['C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C5'],
  },
  'Kharaharapriya': {
    name: 'Kharaharapriya',
    melakarta: 22,
    arohana: ['Sa', 'Ri2', 'Ga2', 'Ma1', 'Pa', 'Da2', 'Ni2', 'Sa'],
    avarohana: ['Sa', 'Ni2', 'Da2', 'Pa', 'Ma1', 'Ga2', 'Ri2', 'Sa'],
    notes: ['C4', 'D4', 'Eb4', 'F4', 'G4', 'A4', 'Bb4', 'C5'],
  },
  'Todi': {
    name: 'Todi',
    melakarta: 8,
    arohana: ['Sa', 'Ri1', 'Ga2', 'Ma1', 'Pa', 'Da1', 'Ni2', 'Sa'],
    avarohana: ['Sa', 'Ni2', 'Da1', 'Pa', 'Ma1', 'Ga2', 'Ri1', 'Sa'],
    notes: ['C4', 'Db4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5'],
  }
};

const SWARA_LABELS = ['Sa', 'Ri', 'Ga', 'Ma', 'Pa', 'Da', 'Ni'];

// Map pitch string back to standard Swara name relative to Raga
export function pitchToSwara(pitch: string, ragaName: string): string {
  const raga = CARNATIC_RAGAS[ragaName];
  if (!raga) return 'Sa';

  // Extract pitch note name, ignoring octave (e.g. Db4 -> Db)
  const normalizedPitch = pitch.replace(/\d+$/, '');
  const baseRagaNotes = raga.notes.map(n => n.replace(/\d+$/, ''));
  
  const index = baseRagaNotes.indexOf(normalizedPitch);
  if (index !== -1) {
    return SWARA_LABELS[index % 7];
  }
  return 'Sa';
}

// Generate Carnatic Lesson melodies
export function generateCarnaticLesson(
  lessonType: 'sarali' | 'janta' | 'alankara' | 'geetham',
  ragaName: string,
  lessonNumber: number = 1
): Note[] {
  const raga = CARNATIC_RAGAS[ragaName] || CARNATIC_RAGAS['Mayamalavagowla'];
  const scale = raga.notes; // Sa=C4, Ri=Db4, Ga=E4, Ma=F4, Pa=G4, Da=Ab4, Ni=B4, Sa'=C5

  const notes: Note[] = [];
  const addNote = (scaleIndex: number, duration: NoteDuration = 'q') => {
    let pitchIndex = scaleIndex;
    let octaveOffset = 0;
    
    if (scaleIndex >= 8) {
      pitchIndex = scaleIndex - 7;
      octaveOffset = 1;
    }
    
    const basePitch = scale[pitchIndex % scale.length];
    const letter = basePitch.replace(/\d+$/, '');
    const oct = parseInt(basePitch.match(/\d+$/)?.[0] || '4', 10);
    const finalPitch = `${letter}${oct + octaveOffset}`;

    notes.push({
      pitch: finalPitch,
      duration,
      type: 'note',
      swara: SWARA_LABELS[scaleIndex % 7] + (scaleIndex >= 7 ? "'" : ''),
    });
  };

  if (lessonType === 'sarali') {
    // Sarali Varisai 1: Sa Ri Ga Ma | Pa Da Ni Sa (Ascending / Descending)
    if (lessonNumber === 1) {
      // Ascending
      for (let i = 0; i < 8; i++) addNote(i);
      // Descending
      for (let i = 7; i >= 0; i--) addNote(i);
    } 
    // Sarali Varisai 2: Sa Ri | Sa Ri | Sa Ri Ga Ma...
    else if (lessonNumber === 2) {
      addNote(0); addNote(1); addNote(0); addNote(1);
      for (let i = 0; i < 4; i++) addNote(i);
      addNote(7); addNote(6); addNote(7); addNote(6);
      for (let i = 7; i >= 4; i--) addNote(i);
    }
    // Sarali Varisai 3: Sa Ri Ga | Sa Ri Ga | Sa Ri Ga Ma...
    else {
      addNote(0); addNote(1); addNote(2);
      addNote(0); addNote(1); addNote(2);
      for (let i = 0; i < 4; i++) addNote(i);
      addNote(7); addNote(6); addNote(5);
      addNote(7); addNote(6); addNote(5);
      for (let i = 7; i >= 4; i--) addNote(i);
    }
  } 
  
  else if (lessonType === 'janta') {
    // Janta Varisai: Double Swaras (Sa Sa Ri Ri Ga Ga Ma Ma | Pa Pa Da Da Ni Ni Sa Sa)
    if (lessonNumber === 1) {
      for (let i = 0; i < 8; i++) {
        addNote(i);
        addNote(i);
      }
      for (let i = 7; i >= 0; i--) {
        addNote(i);
        addNote(i);
      }
    } else {
      // Janta Varisai 2: Sa Sa Ri Ri | Ga Ga Ma Ma... with accent patterns
      for (let i = 0; i < 8; i += 2) {
        addNote(i); addNote(i); addNote(i + 1); addNote(i + 1);
      }
      for (let i = 7; i >= 1; i -= 2) {
        addNote(i); addNote(i); addNote(i - 1); addNote(i - 1);
      }
    }
  } 
  
  else if (lessonType === 'alankara') {
    // Dhruva Tala Alankara (4 + 2 + 4 + 4 = 14 beats)
    // Sa Ri Ga Ma | Ri Ga | Sa Ri Ga Ma | Sa Ri Ga Ma
    const pattern = [0, 1, 2, 3, 1, 2, 0, 1, 2, 3, 0, 1, 2, 3];
    pattern.forEach((idx) => addNote(idx));
    
    // Descending
    const descPattern = [7, 6, 5, 4, 6, 5, 7, 6, 5, 4, 7, 6, 5, 4];
    descPattern.forEach((idx) => addNote(idx));
  } 
  
  else if (lessonType === 'geetham') {
    // Simulated simple Sri Gananatha in Malahari / Mayamalavagowla
    // MP | DS' | S'D | PM |... Let's build a short, beautiful 16-note geetham melody
    const geethamSequence = [
      4, 5, 7, 7, // Pa Da Sa' Sa'
      7, 5, 4, 3, // Sa' Da Pa Ma
      4, 3, 1, 0, // Pa Ma Ri Sa
      0, 1, 3, 0  // Sa Ri Ga Sa
    ];
    geethamSequence.forEach((idx, step) => {
      // Mix of half notes and quarter notes
      const dur = step % 4 === 3 ? 'h' : 'q';
      addNote(idx, dur);
    });
  }

  return notes;
}
