'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MAGNITUDES } from '@/lib/types';
import { useSensorTest } from '@/lib/useSensorTest';
import { Buildings } from './Buildings';

export function LiveGraph({
  onTestComplete,
}: {
  onTestComplete: (magnitude: number, readings: { t: number; withoutDamper: number; withDamper: number }[]) => void;
}) {
  const [magnitude, setMagnitude] = useState(5.5);
  const {
    readings,
    running,
    connected,
    demoMode,
    setDemoMode,
    error,
    connectArduino,
    disconnectArduino,
    startTest,
    stopTest,
    resetTest,
  } = useSensorTest();

  const handleStop = () => {
    stopTest();
    if (readings.length > 0) onTestComplete(magnitude, readings);
  };

  const latest = readings[readings.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-900/60 border border-slate-800 p-4">
        <span className="text-sm text-slate-400">Earthquake Magnitude:</span>
        <div className="flex flex-wrap gap-2">
          {MAGNITUDES.map((m) => (
            <button
              key={m}
              disabled={running}
              onClick={() => setMagnitude(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                magnitude === m
                  ? 'bg-amber-500 text-slate-950 border-amber-500'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500'
              } disabled:opacity-40`}
            >
              {m.toFixed(1)}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={demoMode}
              disabled={running}
              onChange={(e) => setDemoMode(e.target.checked)}
              className="accent-amber-500"
            />
            Demo Mode
          </label>

          {!demoMode &&
            (connected ? (
              <button
                onClick={disconnectArduino}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 border border-slate-700 text-emerald-400"
              >
                ● Arduino Connected
              </button>
            ) : (
              <button
                onClick={connectArduino}
                className="px-3 py-1.5 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-300 hover:border-amber-500"
              >
                Connect Arduino
              </button>
            ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => startTest(magnitude)}
          disabled={running || (!demoMode && !connected)}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-medium"
        >
          ▶ Start Test
        </button>
        <button
          onClick={handleStop}
          disabled={!running}
          className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-medium"
        >
          ■ Stop Test
        </button>
        <button
          onClick={resetTest}
          disabled={running}
          className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-medium"
        >
          ↺ Reset
        </button>
      </div>

      {/* 3D Claymorphic Buildings Side-by-Side Simulation */}
      <Buildings
        withoutDamper={latest ? latest.withoutDamper : 0}
        withDamper={latest ? latest.withDamper : 0}
        running={running}
        magnitude={magnitude}
      />

      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 h-[420px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={readings} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="t"
              stroke="#64748b"
              tickFormatter={(v) => `${v.toFixed(1)}s`}
              label={{ value: 'Time (s)', position: 'insideBottom', offset: -2, fill: '#64748b' }}
            />
            <YAxis
              stroke="#64748b"
              label={{ value: 'Sensor Reading', angle: -90, position: 'insideLeft', fill: '#64748b' }}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)}s`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="withoutDamper"
              name="Building 1 — Without Damper"
              stroke="#f87171"
              dot={false}
              isAnimationActive={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="withDamper"
              name="Building 2 — With Damper"
              stroke="#38bdf8"
              dot={false}
              isAnimationActive={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-500">
        {demoMode
          ? 'Demo Mode: simulated readings. Uncheck Demo Mode and connect the Arduino for live sensor data.'
          : connected
          ? 'Connected to Arduino — live sensor data.'
          : 'Not connected. Click "Connect Arduino" (Chrome/Edge required) or enable Demo Mode.'}
      </p>
    </div>
  );
}
