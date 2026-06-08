import React, { useState, useEffect } from 'react';
import { Stats, CustomExercise } from './types';
import { MelodyTrainer } from './components/MelodyTrainer';
import { IntervalTrainer } from './components/IntervalTrainer';
import { ChordTrainer } from './components/ChordTrainer';
import { ProgressionTrainer } from './components/ProgressionTrainer';
import { HarmonizationTrainer } from './components/HarmonizationTrainer';
import { TeacherMode } from './components/TeacherMode';
import { StatsDashboard } from './components/StatsDashboard';
import { CarnaticMode } from './components/CarnaticMode';
import { SheetMusic } from './components/SheetMusic';
import { audioEngine } from './utils/AudioEngine';
import {
  Music,
  Activity,
  Volume2,
  Disc,
  Mic,
  BookOpen,
  Users,
  BarChart2,
  Sun,
  Moon,
  Maximize2,
  Minimize2,
  X,
  Play,
  Award
} from 'lucide-react';

export const App: React.FC = () => {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('melody');
  
  // Full screen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Shared Exercise Modal State
  const [sharedExercise, setSharedExercise] = useState<CustomExercise | null>(null);
  const [sharedModalOpen, setSharedModalOpen] = useState<boolean>(false);
  const [isPlayingShared, setIsPlayingShared] = useState<boolean>(false);

  // Statistics State
  const [stats, setStats] = useState<Stats>(() => {
    const saved = localStorage.getItem('stats');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        totalTimeSpentSec: parsed.totalTimeSpentSec || 0,
        totalQuestionsAnswered: parsed.totalQuestionsAnswered || 0,
        totalCorrectQuestions: parsed.totalCorrectQuestions || 0,
      };
    }
    
    // Default stats template
    return {
      completed: 0,
      accuracySum: 0,
      bestScore: 0,
      weakIntervals: {},
      weakRhythms: {},
      practiceStreak: 1,
      lastPracticeDate: new Date().toISOString().split('T')[0],
      totalTimeSpentSec: 0,
      totalQuestionsAnswered: 0,
      totalCorrectQuestions: 0,
    };
  });

  const [history, setHistory] = useState<Array<{ date: string; score: number }>>(() => {
    const saved = localStorage.getItem('stats_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Handle dark mode side effects
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Handle URL Parameter Parsing for Shared Exercises
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exerciseB64 = params.get('exercise');
    if (exerciseB64) {
      try {
        const decodedJson = decodeURIComponent(escape(atob(exerciseB64)));
        const exerciseData = JSON.parse(decodedJson) as CustomExercise;
        setSharedExercise(exerciseData);
        setSharedModalOpen(true);
        
        // Clean up URL parameters to keep address bar tidy
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        console.error('Failed to parse shareable exercise parameter.', e);
      }
    }
  }, []);

  // Full Screen API wrapper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => {
        console.error('Error enabling fullscreen', err);
      });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen state if exit is pressed via ESC
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update Stats Handlers
  const handleAddScore = (
    score: number,
    intervalName?: string,
    rhythmType?: string,
    timeTakenSec?: number,
    subCorrect?: number,
    subTotal?: number
  ) => {
    const today = new Date().toISOString().split('T')[0];
    
    setStats((prev) => {
      // Calculate streak
      let newStreak = prev.practiceStreak;
      if (prev.lastPracticeDate) {
        const lastDate = new Date(prev.lastPracticeDate);
        const currentDate = new Date(today);
        const diffDays = Math.floor((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
        
        if (diffDays === 1) {
          newStreak += 1;
        } else if (diffDays > 1) {
          newStreak = 1;
        }
      }

      // Track weak elements (error logging)
      const updatedIntervals = { ...prev.weakIntervals };
      if (score < 100 && intervalName) {
        updatedIntervals[intervalName] = (updatedIntervals[intervalName] || 0) + 1;
      }

      const updatedRhythms = { ...prev.weakRhythms };
      if (score < 100 && rhythmType) {
        updatedRhythms[rhythmType] = (updatedRhythms[rhythmType] || 0) + 1;
      }

      const addedQuestions = subTotal !== undefined ? subTotal : 1;
      const addedCorrect = subCorrect !== undefined ? subCorrect : (score === 100 ? 1 : 0);

      const nextStats = {
        completed: prev.completed + 1,
        accuracySum: prev.accuracySum + score,
        bestScore: Math.max(prev.bestScore, score),
        weakIntervals: updatedIntervals,
        weakRhythms: updatedRhythms,
        practiceStreak: newStreak,
        lastPracticeDate: today,
        totalTimeSpentSec: (prev.totalTimeSpentSec || 0) + (timeTakenSec || 0),
        totalQuestionsAnswered: (prev.totalQuestionsAnswered || 0) + addedQuestions,
        totalCorrectQuestions: (prev.totalCorrectQuestions || 0) + addedCorrect,
      };

      localStorage.setItem('stats', JSON.stringify(nextStats));
      return nextStats;
    });

    setHistory((prev) => {
      const nextHistory = [...prev, { date: today, score }].slice(-20); // Keep last 20
      localStorage.setItem('stats_history', JSON.stringify(nextHistory));
      return nextHistory;
    });
  };

  const handleClearStats = () => {
    const cleared: Stats = {
      completed: 0,
      accuracySum: 0,
      bestScore: 0,
      weakIntervals: {},
      weakRhythms: {},
      practiceStreak: 1,
      lastPracticeDate: new Date().toISOString().split('T')[0],
      totalTimeSpentSec: 0,
      totalQuestionsAnswered: 0,
      totalCorrectQuestions: 0,
    };
    setStats(cleared);
    setHistory([]);
    localStorage.removeItem('stats');
    localStorage.removeItem('stats_history');
  };

  const playSharedExercise = () => {
    if (!sharedExercise) return;
    
    if (isPlayingShared) {
      audioEngine.stop();
      setIsPlayingShared(false);
      return;
    }

    setIsPlayingShared(true);
    audioEngine.setTempo(sharedExercise.tempo);
    audioEngine.setInstrument(sharedExercise.instrument);
    audioEngine.playMelody(
      sharedExercise.notes,
      () => {},
      () => {
        setIsPlayingShared(false);
      }
    );
  };

  const tabs = [
    { id: 'melody', label: 'Melody Trainer', icon: Music },
    { id: 'interval', label: 'Interval Quiz', icon: Volume2 },
    { id: 'chord', label: 'Chord Quiz', icon: Disc },
    { id: 'progression', label: 'Progression Quiz', icon: Activity },
    { id: 'harmonization', label: 'Harmonization Quiz', icon: Music },
    { id: 'carnatic', label: 'Carnatic Mode', icon: BookOpen },
    { id: 'teacher', label: 'Teacher Mode', icon: Users },
    { id: 'stats', label: 'Stats Dashboard', icon: BarChart2 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/80 flex flex-col justify-between hidden md:flex shrink-0">
        
        {/* App Title */}
        <div className="p-6">
          <h1 className="text-xl font-black font-display tracking-tight bg-gradient-to-r from-music-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-2">
            <span>🎵</span> Melody Ear Trainer Pro
          </h1>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5 pl-6">
            Pro Edition
          </p>
        </div>

        {/* Navigation Tabs List */}
        <nav className="flex-1 px-4 space-y-1.5 py-4 overflow-y-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  audioEngine.stop();
                  setActiveTab(tab.id);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-music-600 text-white shadow-md shadow-music-500/10'
                    : 'text-slate-600 dark:text-slate-450 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3">
          <button
            onClick={() => setIsDark(!isDark)}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-250/20 dark:border-slate-750 text-slate-600 dark:text-slate-400 hover:scale-105 active:scale-95 transition-all"
            title="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-250/20 dark:border-slate-750 text-slate-600 dark:text-slate-400 hover:scale-105 active:scale-95 transition-all"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area Container */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Mobile Header Bar */}
        <header className="md:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between z-10 shrink-0">
          <h1 className="text-base font-black font-display tracking-tight bg-gradient-to-r from-music-600 to-accent-600 bg-clip-text text-transparent flex items-center gap-1.5">
            <span>🎵</span> Melody Ear Trainer Pro
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </header>

        {/* Mobile Tab Swiper/Slider */}
        <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-850 flex gap-1.5 overflow-x-auto py-2.5 px-3 scrollbar-none shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  audioEngine.stop();
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all ${
                  isActive
                    ? 'bg-music-600 text-white shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Active Tab View Window */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === 'melody' && <MelodyTrainer onAddScore={(s, time, correct, total) => handleAddScore(s, undefined, undefined, time, correct, total)} />}
          {activeTab === 'interval' && <IntervalTrainer onAddScore={(s, interval, time) => handleAddScore(s, interval, undefined, time)} />}
          {activeTab === 'chord' && <ChordTrainer onAddScore={(s, time) => handleAddScore(s, undefined, undefined, time)} />}
          {activeTab === 'progression' && <ProgressionTrainer onAddScore={(s, time, correct, total) => handleAddScore(s, undefined, undefined, time, correct, total)} />}
          {activeTab === 'harmonization' && <HarmonizationTrainer onAddScore={(s, time, correct, total) => handleAddScore(s, undefined, undefined, time, correct, total)} />}
          {activeTab === 'carnatic' && <CarnaticMode />}
          {activeTab === 'teacher' && <TeacherMode />}
          {activeTab === 'stats' && <StatsDashboard stats={stats} history={history} onClearStats={handleClearStats} />}
        </main>
      </div>

      {/* Shareable Custom Exercise Modal popup */}
      {sharedModalOpen && sharedExercise && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full border border-slate-200/60 dark:border-slate-800/65 shadow-2xl relative space-y-4">
            
            <button
              onClick={() => {
                audioEngine.stop();
                setSharedModalOpen(false);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
              <div className="w-10 h-10 rounded-xl bg-music-500/10 flex items-center justify-center text-music-600">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-base">Custom Exercise Assigned!</h3>
                <p className="text-xs text-slate-400">Created by your teacher or peer.</p>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{sharedExercise.title}</span>
              <p className="text-xs text-slate-500">{sharedExercise.description}</p>
              <div className="flex gap-4 text-[10px] font-mono text-slate-450 dark:text-slate-500 pt-1">
                <span>Tempo: {sharedExercise.tempo} BPM</span>
                <span>Meter: {sharedExercise.timeSignature}</span>
                <span>Instrument: {sharedExercise.instrument.toUpperCase()}</span>
              </div>
            </div>

            {/* Notation */}
            <SheetMusic notes={sharedExercise.notes} timeSignature={sharedExercise.timeSignature} activeNoteIndex={null} />

            <div className="flex gap-2">
              <button
                onClick={playSharedExercise}
                className="flex-1 glass-button-primary text-xs py-2.5 flex justify-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-white" />
                {isPlayingShared ? 'Stop' : 'Play Shared Practice'}
              </button>
              <button
                onClick={() => {
                  audioEngine.stop();
                  // Load directly into active practice sheet
                  // Redirect to melody page or load
                  setSharedModalOpen(false);
                }}
                className="glass-button-secondary text-xs px-4"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
export default App;
