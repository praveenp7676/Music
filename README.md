# Melody Ear Trainer Pro

Melody Ear Trainer Pro is a premium, feature-rich React + TypeScript + Tailwind CSS web application built for music students and teachers. It is designed to run locally or deploy instantly on Vercel, Netlify, and GitHub Pages. 

Master melody recognition, intervals, chords, rhythm, sight-singing feedback, and Carnatic music with an interactive, modern layout optimized for desktop, tablets, and mobile devices.

---

## 🌟 Main Features

1. **Melody Generator**
   - Algorithmic melody generation based on selected notes (including chromatic notes).
   - Constrained to scale selections and pitch settings.

2. **Advanced Rhythm Generator**
   - Mixed note values (Whole, Half, Quarter, Eighth, Sixteenth, Dotted, and Rests).
   - Foolproof rhythm partitioning that guarantees complete measures with zero bar overflows.

3. **Scale Selection**
   - Major, Natural Minor, Harmonic Minor, Melodic Minor.
   - Modes (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian).

4. **Multiple Playback Modes**
   - Manual, Auto Repeat, Slow Practice (50% speed), Call and Response.

5. **Audio Engine (Tone.js)**
   - Custom synthesized high-quality physical modeling voices.
   - Support for Piano, Violin, Flute, Nylon Guitar, and Synthesizer.
   - Low-latency real-time tempo changes.

6. **Music Notation (VexFlow)**
   - Clean, SVG-based responsive notation engraving.
   - Real-time purple highlighting overlays on active notes during playback.

7. **Interval & Chord Recognition Quizzes**
   - Multiple choice ear training questions.
   - Arpeggiated or solid block chord playbacks.
   - Immediate feedback and statistics logging.

8. **Rhythm Dictation Mode**
   - Hear a rhythm-only sequence and match it to the correct notation choice.

9. **Sight Singing Mode**
   - Show sheet music, record microphone audio, and extract frequencies using a real-time Autocorrelation pitch detector.
   - Compare sung pitches to target pitches and display accuracy with a visual matching map.

10. **Carnatic Music Mode**
    - Specialized support for Mayamalavagowla, Kalyani, Sankarabharanam, Kharaharapriya, and Todi ragas.
    - Arohana / Avarohana swara mappings and Melakarta indicators.
    - basic lessons (Sarali, Janta, Alankaras, Geethams) with swara lyrics tracking.
    - Interactive Swara touchpads.

11. **Teacher Mode & PDF/MIDI Export**
    - Compose custom exercises.
    - Export sheets as high-quality PDFs (containing notes and descriptions) or download as MIDI and MusicXML.
    - Database-less URL sharing: compressing custom exercises into base64 parameters for students to open.

12. **Statistics Dashboard (Recharts)**
    - Track practice streak, average accuracy, exercises completed.
    - Live line graphs mapping accuracy progression and bar charts mapping weak intervals and rhythms.

---

## 📁 Folder Structure

```
E:/music/
├── index.html               # Main HTML entry point
├── package.json             # NPM dependencies & scripts
├── postcss.config.js        # PostCSS configuration
├── tailwind.config.js       # Tailwind CSS theme & typography settings
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite build parameters
├── README.md                # This guide
└── src/
    ├── main.tsx             # React DOM root mounting
    ├── index.css            # Tailwind directives & global styling
    ├── App.tsx              # Shell layout, tab routing, URL parameter handler
    ├── types.ts             # Strict TypeScript declarations
    ├── components/
    │   ├── SheetMusic.tsx   # VexFlow rendering sheet music
    │   ├── MelodyTrainer.tsx# Melody Generator panel, controls, quiz
    │   ├── IntervalTrainer.tsx# Interval Recognition quiz
    │   ├── ChordTrainer.tsx # Chord Recognition quiz
    │   ├── RhythmDictation.tsx# Rhythm matching dictation
    │   ├── SightSinging.tsx # Mic input pitch detector & chart
    │   ├── TeacherMode.tsx  # Custom editor, share links, PDF exporter
    │   └── StatsDashboard.tsx# Recharts visual statistics dashboard
    └── utils/
        ├── AudioEngine.ts   # Tone.js wrapper & instruments
        ├── melodyGen.ts     # Pitch/rhythm generation algorithms & AI styles
        ├── carnaticGen.ts   # Swara mappings & lessons
        ├── pitchDetection.ts# Autocorrelation microphone frequency detector
        ├── midi.ts          # MIDI byte-stream exporter
        └── musicxml.ts      # MusicXML text markup generator
```

---

## 🚀 Local Installation & Running

1. **Prerequisites**
   Ensure you have [Node.js](https://nodejs.org) (v16+) installed.

2. **Clone / Open Workspace**
   Open the terminal in the project directory:
   ```bash
   cd e:/music
   ```

3. **Install Dependencies**
   Run the package installation command:
   ```bash
   npm install
   ```

4. **Start Development Server**
   Start the local hot-reloaded development server:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

5. **Build for Production**
   To compile and package the app for production deployment:
   ```bash
   npm run build
   ```
   This compiles TypeScript and outputs a optimized static bundle in the `dist` directory.

---

## 🌐 Deployment Guide

This app is structured as a client-side single-page app, meaning it can be hosted on free serverless platforms with zero backend databases.

### 1. Deploy on Vercel
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in the project root directory.
3. Link to your Vercel account, select default options, and your site will be live in seconds.
4. *Or:* Link your GitHub repository to Vercel dashboard and enable auto-deploys on commit.
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 2. Deploy on Netlify
1. Create a free account on [Netlify](https://www.netlify.com).
2. Connect your GitHub repository.
3. Configure build settings:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Click **Deploy site**.

### 3. Deploy on GitHub Pages
1. Install `gh-pages` helper: `npm install --save-dev gh-pages`
2. Add the following scripts to `package.json`:
   ```json
   "predeploy": "npm run build",
   "deploy": "gh-pages -d dist"
   ```
3. Set your project homepage in `package.json`:
   ```json
   "homepage": "https://<your-username>.github.io/<your-repo-name>"
   ```
4. Run deployment script:
   ```bash
   npm run deploy
   ```
5. In your GitHub repository settings, set the source branch for Pages to `gh-pages`.
