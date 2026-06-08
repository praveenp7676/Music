import React, { useState, useEffect } from 'react';
import { Stats } from '../types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Trophy, Calendar, CheckCircle, Flame, BarChart2, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

interface StatsDashboardProps {
  stats: Stats;
  history: Array<{ date: string; score: number }>;
  onClearStats: () => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  stats,
  history,
  onClearStats,
}) => {
  // Convert history data to chart format
  const chartProgressData = history.map((item, idx) => ({
    name: `Ex ${idx + 1}`,
    accuracy: item.score,
  }));

  // Convert weak intervals map to chart format
  const chartIntervalsData = Object.entries(stats.weakIntervals).map(([interval, count]) => ({
    name: interval,
    errors: count,
  })).sort((a, b) => b.errors - a.errors);

  // Convert weak rhythms map to chart format
  const chartRhythmsData = Object.entries(stats.weakRhythms).map(([rhythm, count]) => ({
    name: rhythm,
    errors: count,
  })).sort((a, b) => b.errors - a.errors);

  const averageAccuracy = stats.completed > 0 ? Math.round(stats.accuracySum / stats.completed) : 0;
  const averageTime = stats.totalQuestionsAnswered && stats.totalQuestionsAnswered > 0
    ? (stats.totalTimeSpentSec || 0) / stats.totalQuestionsAnswered
    : 0;

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Exercises Card */}
        <div className="glass-card rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-music-500/10 flex items-center justify-center text-music-600 dark:text-music-400">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Completed</span>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats.completed}</span>
          </div>
        </div>

        {/* Accuracy Card */}
        <div className="glass-card rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-500/10 flex items-center justify-center text-accent-600 dark:text-accent-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Average Acc</span>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{averageAccuracy}%</span>
          </div>
        </div>

        {/* Best Score Card */}
        <div className="glass-card rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Best Score</span>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats.bestScore}%</span>
          </div>
        </div>

        {/* Streak Card */}
        <div className="glass-card rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Streak</span>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats.practiceStreak} Days</span>
          </div>
        </div>

        {/* Average Time Card */}
        <div className="glass-card rounded-3xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Avg Speed</span>
            <span className="text-xl font-bold text-slate-700 dark:text-slate-200">
              {averageTime > 0 ? `${averageTime.toFixed(1)}s` : '-'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Progress Chart */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-6 flex flex-col justify-between min-h-[350px]">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-display font-bold text-base">Accuracy Progression</h3>
              <p className="text-xs text-slate-500">Your score history over recent practices.</p>
            </div>
            <button
              onClick={onClearStats}
              className="text-xs font-semibold text-red-500 hover:underline"
            >
              Reset Data
            </button>
          </div>

          {chartProgressData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="105%" height="100%">
                <LineChart data={chartProgressData} margin={{ top: 10, right: 30, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Line type="monotone" dataKey="accuracy" stroke="#0ea5e9" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
              <BarChart2 className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-xs font-semibold text-slate-400">No practice history found</p>
              <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                Complete your first ear training exercise in the practice tabs to chart your progress.
              </p>
            </div>
          )}
        </div>

        {/* Weaknesses Dashboard */}
        <div className="lg:col-span-1 glass-card rounded-3xl p-6 flex flex-col min-h-[350px]">
          <h3 className="font-display font-bold text-base mb-1">Interval Weakness Map</h3>
          <p className="text-xs text-slate-500 mb-4">Intervals where you submitted incorrect answers.</p>

          {chartIntervalsData.length > 0 ? (
            <div className="flex-1 h-64 w-full">
              <ResponsiveContainer width="105%" height="100%">
                <BarChart data={chartIntervalsData} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={80} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="errors" fill="#a855f7" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
              <AlertTriangle className="w-7 h-7 text-slate-350 dark:text-slate-650 mb-2" />
              <p className="text-xs font-semibold text-slate-400">Perfect Streak!</p>
              <p className="text-[10px] text-slate-500 mt-1">
                No weak intervals recorded yet. Keep practicing with the Interval Trainer tab.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* Rhythm Weaknesses Row */}
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display font-bold text-base mb-1">Rhythm Error Breakdown</h3>
        <p className="text-xs text-slate-500 mb-4">Error occurrences classified by note duration types.</p>
        
        {chartRhythmsData.length > 0 ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRhythmsData} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="errors" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 dark:bg-slate-900/30">
            <CheckCircle className="w-8 h-8 text-green-400 mb-2 animate-bounce" />
            <p className="text-xs font-semibold text-slate-400 font-display">No Rhythm Errors</p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Outstanding accuracy. Rhythm weaknesses will populate as errors accumulate.
            </p>
          </div>
        )}
      </div>

    </div>
  );
};
export default StatsDashboard;
