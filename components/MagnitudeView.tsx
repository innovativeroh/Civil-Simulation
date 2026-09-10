'use client';

import { useState } from 'react';
import { effectiveness, MAGNITUDES, MagnitudeResult } from '@/lib/types';
import { Buildings } from './Buildings';

export function MagnitudeView({ results }: { results: Record<number, MagnitudeResult> }) {
  const [selected, setSelected] = useState(5.5);
  const result = results[selected];

  const rows = result
    ? [
        { label: 'Peak Ground Acceleration (PGA)', without: result.peakWithout, withD: result.peakWith },
        { label: 'Maximum Peak-to-Peak Vibration', without: result.maxVibrationWithout, withD: result.maxVibrationWith },
        { label: 'Average Seismic Amplitude', without: result.avgWithout, withD: result.avgWith },
      ]
    : [];

  const peakEffectiveness = result ? effectiveness(result.peakWithout, result.peakWith) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <div className="text-sm text-slate-400 mb-3">Earthquake Magnitude</div>
        <div className="flex flex-wrap gap-2">
          {MAGNITUDES.map((m) => (
            <button
              key={m}
              onClick={() => setSelected(m)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                selected === m
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500'
              }`}
            >
              {m.toFixed(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="text-center text-2xl font-semibold text-slate-100">
        Magnitude: <span className="text-amber-400">{selected.toFixed(1)}</span>
      </div>

      {!result ? (
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-8 text-center text-slate-500">
          No recorded test yet for magnitude {selected.toFixed(1)}. Run a test in the Live Graph
          tab with this magnitude selected, then stop it to record results here.
        </div>
      ) : (
        <>
          <Buildings
            withoutDamper={result.peakWithout}
            withDamper={result.peakWith}
            magnitude={selected}
          />

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/60 text-slate-300">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Reading Metric</th>
                  <th className="text-right px-4 py-3 font-medium">Without Damper</th>
                  <th className="text-right px-4 py-3 font-medium">With Damper</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-slate-800 bg-slate-900/40">
                    <td className="px-4 py-3 text-slate-300">{r.label}</td>
                    <td className="px-4 py-3 text-right text-red-400 font-mono">
                      {r.without.toFixed(3)}
                    </td>
                    <td className="px-4 py-3 text-right text-sky-400 font-mono">
                      {r.withD.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl bg-emerald-950/40 border border-emerald-800 p-6 text-center">
            <div className="text-sm text-emerald-300 mb-1">Damper Effectiveness (Peak Reading)</div>
            <div className="text-4xl font-bold text-emerald-400">
              {peakEffectiveness !== null ? `${peakEffectiveness.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-emerald-500/70 mt-2">
              Reduction = ((Without Damper − With Damper) / Without Damper) × 100
            </div>
          </div>
        </>
      )}
    </div>
  );
}
