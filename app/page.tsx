'use client';

import { useState } from 'react';
import { LiveGraph } from '@/components/LiveGraph';
import { MagnitudeView } from '@/components/MagnitudeView';
import { useResultsStore } from '@/lib/useResultsStore';
import { Reading } from '@/lib/types';

type Tab = 'graph' | 'magnitude';

export default function Home() {
  const [tab, setTab] = useState<Tab>('graph');
  const { results, saveResult } = useResultsStore();

  const handleTestComplete = (magnitude: number, readings: Reading[]) => {
    saveResult(magnitude, readings);
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="text-center space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">
          Earthquake Resistant Infrastructure
        </h1>
        <p className="text-slate-500 text-sm">
          Live Arduino sensor comparison — building with and without a damper
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setTab('graph')}
          className={`rounded-xl py-4 text-lg font-semibold border transition ${
            tab === 'graph'
              ? 'bg-amber-500 text-slate-950 border-amber-500'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-amber-500'
          }`}
        >
          📈 Live Graph
        </button>
        <button
          onClick={() => setTab('magnitude')}
          className={`rounded-xl py-4 text-lg font-semibold border transition ${
            tab === 'magnitude'
              ? 'bg-amber-500 text-slate-950 border-amber-500'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-amber-500'
          }`}
        >
          🌎 Earthquake Magnitude
        </button>
      </div>

      {tab === 'graph' ? (
        <LiveGraph onTestComplete={handleTestComplete} />
      ) : (
        <MagnitudeView results={results} />
      )}
    </main>
  );
}
