import { Note, TimeSignature } from '../types';
import { BEAT_MAP } from './AudioEngine';

interface XmlNoteInfo {
  step: string;
  alter: number;
  octave: number;
  duration: number;
  type: string;
  dot: boolean;
  rest: boolean;
}

const XML_DURATION_MAP: Record<string, { duration: number; type: string; dot: boolean }> = {
  'w': { duration: 64, type: 'whole', dot: false },
  'h': { duration: 32, type: 'half', dot: false },
  'q': { duration: 16, type: 'quarter', dot: false },
  '8': { duration: 8, type: 'eighth', dot: false },
  '16': { duration: 4, type: '16th', dot: false },
  'wd': { duration: 96, type: 'whole', dot: true },
  'hd': { duration: 48, type: 'half', dot: true },
  'qd': { duration: 24, type: 'quarter', dot: true },
  '8d': { duration: 12, type: 'eighth', dot: true },
  '16d': { duration: 6, type: '16th', dot: true },
};

function parseNoteForXml(note: Note): XmlNoteInfo {
  const defaults = XML_DURATION_MAP[note.duration] || { duration: 16, type: 'quarter', dot: false };
  
  if (note.type === 'rest' || note.pitch === 'R') {
    return {
      step: 'B',
      alter: 0,
      octave: 4,
      duration: defaults.duration,
      type: defaults.type,
      dot: defaults.dot,
      rest: true,
    };
  }

  const match = note.pitch.match(/^([A-G])(#|b)?(\d)$/i);
  if (!match) {
    return { step: 'C', alter: 0, octave: 4, duration: defaults.duration, type: defaults.type, dot: defaults.dot, rest: true };
  }

  const [, letter, accidental, octaveStr] = match;
  let alter = 0;
  if (accidental === '#') alter = 1;
  if (accidental === 'b') alter = -1;

  return {
    step: letter.toUpperCase(),
    alter,
    octave: parseInt(octaveStr, 10),
    duration: defaults.duration,
    type: defaults.type,
    dot: defaults.dot,
    rest: false,
  };
}

export function exportToMusicXml(notes: Note[], timeSignature: TimeSignature, title: string = 'Melody_Trainer_Exercise') {
  const [numStr, denStr] = timeSignature.split('/');
  const beats = parseInt(numStr, 10);
  const beatType = parseInt(denStr, 10);
  const beatsPerBar = beats * (4 / beatType);

  // Group notes into measures
  const measures: Note[][] = [];
  let currentMeasure: Note[] = [];
  let accumBeats = 0;

  notes.forEach((note) => {
    const noteBeats = BEAT_MAP[note.duration];
    if (accumBeats + noteBeats > beatsPerBar + 0.001) {
      if (currentMeasure.length > 0) {
        measures.push(currentMeasure);
      }
      currentMeasure = [note];
      accumBeats = noteBeats;
    } else {
      currentMeasure.push(note);
      accumBeats += noteBeats;
      if (Math.abs(accumBeats - beatsPerBar) < 0.001) {
        measures.push(currentMeasure);
        currentMeasure = [];
        accumBeats = 0;
      }
    }
  });
  if (currentMeasure.length > 0) {
    measures.push(currentMeasure);
  }

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC
    "-//Recordare//DTD MusicXML 4.0 Partwise//EN"
    "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${title}</work-title>
  </work>
  <part-list>
    <score-part id="P1">
      <part-name>Melody</part-name>
    </score-part>
  </part-list>
  <part id="P1">
`;

  measures.forEach((measureNotes, measureIdx) => {
    xml += `    <measure number="${measureIdx + 1}">\n`;
    
    // Add attributes to first measure
    if (measureIdx === 0) {
      xml += `      <attributes>
        <divisions>16</divisions>
        <key>
          <fifths>0</fifths>
        </key>
        <time>
          <beats>${beats}</beats>
          <beat-type>${beatType}</beat-type>
        </time>
        <clef>
          <sign>G</sign>
          <line>2</line>
        </clef>
      </attributes>\n`;
    }

    measureNotes.forEach((note) => {
      const info = parseNoteForXml(note);
      xml += `      <note>\n`;
      if (info.rest) {
        xml += `        <rest/>\n`;
      } else {
        xml += `        <pitch>\n`;
        xml += `          <step>${info.step}</step>\n`;
        if (info.alter !== 0) {
          xml += `          <alter>${info.alter}</alter>\n`;
        }
        xml += `          <octave>${info.octave}</octave>\n`;
        xml += `        </pitch>\n`;
      }
      xml += `        <duration>${info.duration}</duration>\n`;
      xml += `        <voice>1</voice>\n`;
      xml += `        <type>${info.type}</type>\n`;
      if (info.dot) {
        xml += `        <dot/>\n`;
      }
      xml += `      </note>\n`;
    });

    xml += `    </measure>\n`;
  });

  xml += `  </part>\n</score-partwise>\n`;

  // Trigger browser download
  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.musicxml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
export default exportToMusicXml;
