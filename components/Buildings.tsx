'use client';

import { useMemo, useState } from 'react';
import { getSeismicIntensity, SensorUnit } from '@/lib/types';

interface BuildingsProps {
  withoutDamper?: number;
  withDamper?: number;
  running?: boolean;
  magnitude?: number;
  unit?: SensorUnit;
  sampleRateHz?: number;
  isDualSensor?: boolean;
}

export function Buildings({
  withoutDamper = 0,
  withDamper = 0,
  running = false,
  magnitude = 5.5,
  unit = 'g',
  sampleRateHz = 0,
  isDualSensor = false,
}: BuildingsProps) {
  // Manual sway override when test is not running so user can play with the clay physics anytime
  const [manualSway, setManualSway] = useState(0);

  // Active sway values (use live test sensor data if running or if values are non-zero, otherwise manual)
  const isLive = running || withoutDamper !== 0 || withDamper !== 0;
  
  const rawWithout = isLive ? withoutDamper : manualSway;
  // Tuned mass damper attenuates vibration by ~60-75% with a counter-phase lag
  const rawWith = isLive ? withDamper : manualSway * 0.35;

  // Calculate sway angles and structural stress based on MPU-6050 physical units
  const { sway1Angle, sway2Angle, stress1, stress2 } = useMemo(() => {
    if (!isLive) {
      // Manual slider mode (-15 deg to +15 deg)
      const a1 = manualSway;
      const a2 = manualSway * 0.35;
      const s1 = Math.min(100, Math.round((Math.abs(manualSway) / 14) * 100));
      const s2 = Math.min(100, Math.round((Math.abs(manualSway * 0.35) / 14) * 100));
      return { sway1Angle: a1, sway2Angle: a2, stress1: s1, stress2: s2 };
    }

    // Physical MPU-6050 sensor mode:
    let s1 = 0;
    let s2 = 0;
    let a1 = 0;
    let a2 = 0;

    if (unit === 'mps2') {
      // 1g = 9.81 m/s^2; 7.8 m/s^2 is severe earthquake lateral acceleration
      s1 = Math.min(100, Math.round((Math.abs(rawWithout) / 7.8) * 100));
      s2 = Math.min(100, Math.round((Math.abs(rawWith) / 7.8) * 100));
      a1 = Math.max(-18, Math.min(18, (rawWithout / 7.8) * 15));
      a2 = Math.max(-18, Math.min(18, (rawWith / 7.8) * 15));
    } else if (unit === 'deg') {
      s1 = Math.min(100, Math.round((Math.abs(rawWithout) / 15) * 100));
      s2 = Math.min(100, Math.round((Math.abs(rawWith) / 15) * 100));
      a1 = Math.max(-18, Math.min(18, rawWithout));
      a2 = Math.max(-18, Math.min(18, rawWith));
    } else {
      // Unit = 'g' (standard MPU-6050 accelerometer output)
      // 0.8g lateral acceleration is critical structural collapse threshold
      s1 = Math.min(100, Math.round((Math.abs(rawWithout) / 0.8) * 100));
      s2 = Math.min(100, Math.round((Math.abs(rawWith) / 0.8) * 100));
      a1 = Math.max(-18, Math.min(18, (rawWithout / 0.8) * 15));
      a2 = Math.max(-18, Math.min(18, (rawWith / 0.8) * 15));
    }

    return { sway1Angle: a1, sway2Angle: a2, stress1: s1, stress2: s2 };
  }, [isLive, manualSway, rawWithout, rawWith, unit]);

  // Tuned Mass Damper counter-oscillation (swings opposite to building tilt)
  const tmdCounterSway = -sway2Angle * 2.2;

  // Seismic intensity category from MPU-6050 accelerometer reading
  const intensity1 = useMemo(() => {
    const gVal = unit === 'mps2' ? rawWithout / 9.80665 : unit === 'deg' ? (rawWithout / 15) * 0.8 : rawWithout;
    return getSeismicIntensity(gVal);
  }, [rawWithout, unit]);

  // Attenuation percentage
  const attenuation = useMemo(() => {
    if (Math.abs(rawWithout) < 0.01) return 65;
    const diff = Math.abs(rawWithout) - Math.abs(rawWith);
    return Math.max(0, Math.min(95, Math.round((diff / Math.abs(rawWithout)) * 100)));
  }, [rawWithout, rawWith]);


  return (
    <div
      className="relative w-full rounded-[36px] p-6 sm:p-8 overflow-hidden transition-all duration-300"
      style={{
        background: 'linear-gradient(160deg, #1b2234 0%, #121724 100%)',
        boxShadow: `
          18px 18px 36px rgba(0, 0, 0, 0.65),
          -10px -10px 28px rgba(255, 255, 255, 0.04),
          inset 2px 2px 4px rgba(255, 255, 255, 0.12),
          inset -3px -3px 8px rgba(0, 0, 0, 0.65)
        `,
        border: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* Header telemetry and badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="text-lg sm:text-xl font-bold tracking-wide text-slate-100">
              Structural Dynamics Clay Simulation
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Side-by-side seismic response: Unprotected vs Tuned Mass Damper (TMD)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Hardware & Sensor Compatibility Badge */}
          <div
            className="px-3 py-1.5 rounded-full text-xs font-mono font-medium text-cyan-300 flex items-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, #0c2b42, #081a28)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              boxShadow: '2px 2px 6px rgba(0,0,0,0.4)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>MPU-6050</span>
            <span className="text-slate-500">|</span>
            <span>Arduino Uno R3</span>
            {sampleRateHz > 0 && (
              <span className="text-emerald-400 font-bold ml-1">({sampleRateHz} Hz)</span>
            )}
          </div>

          {running && (
            <div
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase text-rose-300 animate-pulse flex items-center gap-1.5"
              style={{
                background: 'linear-gradient(135deg, #7f1d1d, #450a0a)',
                boxShadow: `
                  4px 4px 10px rgba(0,0,0,0.5),
                  inset 1px 1px 2px rgba(255,255,255,0.25),
                  inset -2px -2px 4px rgba(0,0,0,0.4)
                `,
              }}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              Seismic Load Active (M{magnitude.toFixed(1)})
            </div>
          )}
          <div
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-300 flex items-center gap-1.5"
            style={{
              background: 'linear-gradient(135deg, #064e3b, #022c22)',
              boxShadow: `
                4px 4px 10px rgba(0,0,0,0.4),
                inset 1px 1px 2px rgba(255,255,255,0.2),
                inset -2px -2px 4px rgba(0,0,0,0.4)
              `,
            }}
          >
            <span>🛡️ Damper Damping:</span>
            <span className="font-bold font-mono text-emerald-400">~{attenuation}%</span>
          </div>
        </div>
      </div>

      {/* Buildings Display Arena */}
      <div className="relative flex flex-col items-center">
        {/* Sky/Atmosphere ambient backdrop grid */}
        <div className="w-full flex items-end justify-center gap-8 sm:gap-16 md:gap-24 pt-8 pb-4 min-h-[360px] relative">
          
          {/* Ground tremor wave ripples when running */}
          {running && (
            <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-none opacity-40">
              <div className="w-3/4 h-8 bg-gradient-to-r from-transparent via-amber-500/20 to-transparent blur-md animate-pulse" />
            </div>
          )}

          {/* ========================================================================= */}
          {/* BUILDING 1 — WITHOUT DAMPER (Coral / Terracotta Clay) */}
          {/* ========================================================================= */}
          <div className="flex-1 max-w-[240px] flex flex-col items-center">
            {/* Live Sway Indicator Tag */}
            <div
              className={`mb-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
                stress1 > 50
                  ? 'text-rose-200 bg-rose-950/80 border border-rose-600/50 shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                  : 'text-amber-300 bg-amber-950/50 border border-amber-700/40'
              }`}
            >
              {stress1 > 50 ? '⚠️ High Structural Stress' : 'Standard Oscillation'}
            </div>

            {/* Building 1 Structure */}
            <div
              className="relative w-full flex flex-col items-center origin-bottom transition-transform duration-100 ease-out"
              style={{
                transform: `rotate(${sway1Angle}deg) skewX(${sway1Angle * 0.4}deg)`,
              }}
            >
              {/* Rooftop Antenna & Aircraft Warning Beacon */}
              <div className="flex flex-col items-center mb-0.5">
                <div
                  className={`w-2 h-2 rounded-full mb-0.5 ${
                    stress1 > 40 ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-red-600'
                  }`}
                />
                <div
                  className="w-1 h-6 rounded-full"
                  style={{
                    background: '#cbd5e1',
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.7), 2px 2px 4px rgba(0,0,0,0.5)',
                  }}
                />
                {/* Roof Cap */}
                <div
                  className="w-24 h-4 rounded-[14px]"
                  style={{
                    background: 'linear-gradient(145deg, #f87171, #dc2626)',
                    boxShadow: `
                      6px 6px 12px rgba(0,0,0,0.4),
                      inset 2px 2px 3px rgba(255,255,255,0.45),
                      inset -2px -2px 4px rgba(127,29,29,0.7)
                    `,
                  }}
                />
              </div>

              {/* Main Clay Tower Body */}
              <div
                className="w-full max-w-[170px] h-[250px] rounded-[30px] p-3 flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(155deg, #fb7185 0%, #e11d48 55%, #9f1239 100%)',
                  boxShadow: `
                    14px 16px 28px rgba(0, 0, 0, 0.5),
                    -4px -4px 14px rgba(251, 113, 133, 0.2),
                    inset 3px 3px 6px rgba(255, 255, 255, 0.45),
                    inset -4px -4px 8px rgba(76, 5, 25, 0.7)
                  `,
                }}
              >
                {/* 4 Floors of Clay Inset Windows */}
                {[0, 1, 2, 3].map((floor) => (
                  <div key={floor} className="flex justify-around items-center px-1">
                    {[0, 1].map((col) => (
                      <div
                        key={col}
                        className="w-12 h-9 rounded-[14px] flex items-center justify-center transition-all duration-300"
                        style={{
                          background: 'linear-gradient(145deg, #1e1b2b, #110e1a)',
                          boxShadow: `
                            inset 3px 3px 5px rgba(0, 0, 0, 0.8),
                            inset -2px -2px 4px rgba(255, 255, 255, 0.15),
                            1px 1px 2px rgba(255, 255, 255, 0.15)
                          `,
                        }}
                      >
                        {/* Interior Window Lights */}
                        <div
                          className="w-8 h-5 rounded-[8px]"
                          style={{
                            background:
                              stress1 > 60
                                ? 'linear-gradient(135deg, #f87171, #ef4444)'
                                : 'linear-gradient(135deg, #fef08a, #f59e0b)',
                            opacity: 0.85,
                            boxShadow:
                              stress1 > 60
                                ? '0 0 8px rgba(239,68,68,0.7), inset 1px 1px 2px rgba(255,255,255,0.6)'
                                : '0 0 6px rgba(245,158,11,0.5), inset 1px 1px 2px rgba(255,255,255,0.6)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Base Seismic Isolator Pegs (Without Damper = Rigid Bolts) */}
              <div className="w-full max-w-[140px] flex justify-between px-2 pt-1">
                <div
                  className="w-6 h-4 rounded-[6px]"
                  style={{
                    background: '#475569',
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.3), 2px 2px 5px rgba(0,0,0,0.5)',
                  }}
                />
                <div
                  className="w-6 h-4 rounded-[6px]"
                  style={{
                    background: '#475569',
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.3), 2px 2px 5px rgba(0,0,0,0.5)',
                  }}
                />
              </div>
            </div>

            {/* Label and Live Readings Card */}
            <div
              className="mt-4 w-full rounded-2xl p-3.5 text-left"
              style={{
                background: 'linear-gradient(145deg, #22293a, #181e2b)',
                boxShadow: `
                  6px 6px 14px rgba(0,0,0,0.4),
                  inset 1px 1px 2px rgba(255,255,255,0.1),
                  inset -2px -2px 4px rgba(0,0,0,0.4)
                `,
              }}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-rose-300">
                <span>Building 1 — No Damper</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-400 border border-rose-800/40">
                  {unit}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  {unit === 'deg' ? 'Tilt Sway:' : 'Acceleration:'}
                </span>
                <span className="text-base font-mono font-bold text-rose-400">
                  {rawWithout > 0 ? `+${rawWithout.toFixed(3)}` : rawWithout.toFixed(3)}
                  <span className="text-xs text-slate-500 font-normal ml-1">{unit}</span>
                </span>
              </div>
              {/* Seismic Intensity Rating */}
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Seismic Level:</span>
                <span className={`font-medium ${intensity1.color}`}>{intensity1.label}</span>
              </div>
              {/* Stress progress meter */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>Structural Stress</span>
                  <span className={stress1 > 70 ? 'text-rose-400 font-bold' : stress1 > 40 ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                    {stress1}%
                  </span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${stress1}%`,
                      background: stress1 > 70 ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : stress1 > 40 ? '#f59e0b' : '#10b981',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* CENTER SEISMIC COMPARISON DIVIDER */}
          {/* ========================================================================= */}
          <div className="hidden sm:flex flex-col items-center justify-center gap-3 py-6 px-2">
            <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
            
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-lg"
              style={{
                background: 'linear-gradient(145deg, #28334b, #192131)',
                boxShadow: `
                  6px 6px 14px rgba(0,0,0,0.5),
                  -3px -3px 8px rgba(255,255,255,0.06),
                  inset 2px 2px 3px rgba(255,255,255,0.15),
                  inset -2px -2px 4px rgba(0,0,0,0.5)
                `,
              }}
            >
              ⚡
            </div>

            <div className="text-center">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 block">
                VS
              </span>
              <span className="text-[11px] font-mono text-cyan-400 font-bold block mt-0.5">
                -{attenuation}% SWAY
              </span>
            </div>

            <div className="w-px h-16 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          </div>

          {/* ========================================================================= */}
          {/* BUILDING 2 — WITH DAMPER (Tuned Mass Damper - Cyan / Teal Clay) */}
          {/* ========================================================================= */}
          <div className="flex-1 max-w-[240px] flex flex-col items-center">
            {/* Live Status Tag */}
            <div className="mb-3 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-cyan-200 bg-cyan-950/70 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
              🛡️ TMD Stabilized
            </div>

            {/* Building 2 Structure */}
            <div
              className="relative w-full flex flex-col items-center origin-bottom transition-transform duration-100 ease-out"
              style={{
                transform: `rotate(${sway2Angle}deg) skewX(${sway2Angle * 0.35}deg)`,
              }}
            >
              {/* Penthouse Damper Crown with Tuned Mass Damper (TMD) */}
              <div className="flex flex-col items-center mb-0.5 relative">
                {/* Roof Cap with TMD suspension bracket */}
                <div
                  className="w-24 h-4 rounded-[14px] relative z-10"
                  style={{
                    background: 'linear-gradient(145deg, #38bdf8, #0284c7)',
                    boxShadow: `
                      6px 6px 12px rgba(0,0,0,0.4),
                      inset 2px 2px 3px rgba(255,255,255,0.5),
                      inset -2px -2px 4px rgba(3,105,161,0.7)
                    `,
                  }}
                />

                {/* Visible Tuned Mass Damper (TMD) Chamber (Upper Penthouse) */}
                <div
                  className="w-20 h-10 rounded-[14px] -mt-1 p-1 flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(145deg, #0f172a, #090e17)',
                    boxShadow: `
                      inset 3px 3px 6px rgba(0, 0, 0, 0.9),
                      inset -2px -2px 4px rgba(255, 255, 255, 0.1),
                      0 4px 8px rgba(0,0,0,0.3)
                    `,
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                  }}
                >
                  {/* Suspension Cable */}
                  <div
                    className="absolute top-0 w-0.5 h-3 bg-slate-300 origin-top transition-transform duration-75"
                    style={{
                      transform: `rotate(${tmdCounterSway}deg)`,
                    }}
                  />

                  {/* Tuned Mass Damper Clay Ball (Golden Clay Sphere swinging counter to sway) */}
                  <div
                    className="relative z-10 w-6 h-6 rounded-full transition-transform duration-100 ease-out"
                    style={{
                      transform: `translateX(${Math.max(-16, Math.min(16, tmdCounterSway * 1.5))}px)`,
                      background: 'radial-gradient(circle at 35% 30%, #fde047 0%, #eab308 50%, #92400e 90%)',
                      boxShadow: `
                        3px 4px 8px rgba(0, 0, 0, 0.6),
                        inset 2px 2px 3px rgba(255, 255, 255, 0.7),
                        inset -2px -2px 4px rgba(113, 63, 18, 0.8)
                      `,
                    }}
                  />

                  {/* Hydraulic Damping Pistons on sides */}
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-1 bg-cyan-600 rounded-sm" />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-2 h-1 bg-cyan-600 rounded-sm" />
                </div>
              </div>

              {/* Main Clay Tower Body */}
              <div
                className="w-full max-w-[170px] h-[250px] rounded-[30px] p-3 flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(155deg, #38bdf8 0%, #0284c7 55%, #0369a1 100%)',
                  boxShadow: `
                    14px 16px 28px rgba(0, 0, 0, 0.5),
                    -4px -4px 14px rgba(56, 189, 248, 0.25),
                    inset 3px 3px 6px rgba(255, 255, 255, 0.5),
                    inset -4px -4px 8px rgba(2, 44, 75, 0.75)
                  `,
                }}
              >
                {/* 4 Floors of Clay Inset Windows */}
                {[0, 1, 2, 3].map((floor) => (
                  <div key={floor} className="flex justify-around items-center px-1">
                    {[0, 1].map((col) => (
                      <div
                        key={col}
                        className="w-12 h-9 rounded-[14px] flex items-center justify-center transition-all duration-300"
                        style={{
                          background: 'linear-gradient(145deg, #0b1c2d, #07121e)',
                          boxShadow: `
                            inset 3px 3px 5px rgba(0, 0, 0, 0.85),
                            inset -2px -2px 4px rgba(255, 255, 255, 0.15),
                            1px 1px 2px rgba(255, 255, 255, 0.15)
                          `,
                        }}
                      >
                        {/* Interior Window Lights */}
                        <div
                          className="w-8 h-5 rounded-[8px]"
                          style={{
                            background: 'linear-gradient(135deg, #a5f3fc, #38bdf8)',
                            opacity: 0.9,
                            boxShadow: '0 0 8px rgba(56,189,248,0.5), inset 1px 1px 2px rgba(255,255,255,0.7)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Base Viscous Fluid Dampers / Elastic Spring Isolators */}
              <div className="w-full max-w-[140px] flex justify-between px-2 pt-1">
                <div
                  className="w-6 h-4 rounded-[8px] flex flex-col justify-center items-center gap-0.5"
                  style={{
                    background: '#0284c7',
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.4), 2px 2px 5px rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="w-4 h-0.5 bg-slate-900 rounded" />
                </div>
                <div
                  className="w-6 h-4 rounded-[8px] flex flex-col justify-center items-center gap-0.5"
                  style={{
                    background: '#0284c7',
                    boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.4), 2px 2px 5px rgba(0,0,0,0.5)',
                  }}
                >
                  <div className="w-4 h-0.5 bg-slate-900 rounded" />
                </div>
              </div>
            </div>

            {/* Label and Live Readings Card */}
            <div
              className="mt-4 w-full rounded-2xl p-3.5 text-left"
              style={{
                background: 'linear-gradient(145deg, #22293a, #181e2b)',
                boxShadow: `
                  6px 6px 14px rgba(0,0,0,0.4),
                  inset 1px 1px 2px rgba(255,255,255,0.1),
                  inset -2px -2px 4px rgba(0,0,0,0.4)
                `,
              }}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                <span>Building 2 — With Damper</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/70 text-sky-400 border border-sky-800/40">
                  {unit}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-xs text-slate-400 font-mono">
                  {unit === 'deg' ? 'Tilt Sway:' : 'Acceleration:'}
                </span>
                <span className="text-base font-mono font-bold text-sky-400">
                  {rawWith > 0 ? `+${rawWith.toFixed(3)}` : rawWith.toFixed(3)}
                  <span className="text-xs text-slate-500 font-normal ml-1">{unit}</span>
                </span>
              </div>
              {/* Damping Reduction */}
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">TMD Attenuation:</span>
                <span className="font-bold font-mono text-emerald-400">-{attenuation}%</span>
              </div>
              {/* Stress progress meter */}
              <div className="mt-2.5">
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>Damped Stress</span>
                  <span className="text-sky-400 font-semibold">{stress2}%</span>
                </div>
                <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${stress2}%`,
                      background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CLAY SHAKE TABLE / SEISMIC BEDROCK BASE PLATFORM */}
        {/* ========================================================================= */}
        <div
          className={`w-full max-w-[560px] h-14 rounded-[26px] mt-1 relative flex items-center justify-between px-6 transition-transform duration-100 ${
            running ? 'animate-[pulse_0.4s_ease-in-out_infinite]' : ''
          }`}
          style={{
            background: 'linear-gradient(165deg, #2a3449 0%, #171d2b 100%)',
            boxShadow: `
              12px 14px 28px rgba(0, 0, 0, 0.65),
              -6px -6px 20px rgba(255, 255, 255, 0.05),
              inset 2px 2px 4px rgba(255, 255, 255, 0.2),
              inset -3px -3px 6px rgba(0, 0, 0, 0.7)
            `,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {/* Bedrock mechanical details */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-600 shadow-inner" />
            <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
              Seismic Shake Table
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-mono">Status:</span>
            <span
              className={`text-xs font-mono font-bold ${
                running ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {running ? 'VIBRATING' : 'READY / IDLE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-600 shadow-inner" />
          </div>
        </div>

        {/* Foundation support pillars under shake table */}
        <div className="w-full max-w-[480px] flex justify-between px-6 -mt-1">
          {[0, 1, 2, 3].map((p) => (
            <div
              key={p}
              className="w-10 h-3 rounded-b-[10px]"
              style={{
                background: '#131924',
                boxShadow: 'inset 1px 1px 2px rgba(255,255,255,0.1), 2px 3px 6px rgba(0,0,0,0.6)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Manual interactive sway slider when test is idle */}
      {!running && (
        <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">
              🖐️ Interactive Sway Preview:
            </span>
            <span className="text-xs font-mono text-amber-400">
              {manualSway === 0 ? 'Centered' : `${manualSway > 0 ? '+' : ''}${manualSway.toFixed(1)}°`}
            </span>
          </div>

          <div className="flex-1 max-w-xs w-full flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-mono">-15°</span>
            <input
              type="range"
              min={-15}
              max={15}
              step={0.5}
              value={manualSway}
              onChange={(e) => setManualSway(parseFloat(e.target.value))}
              className="w-full"
            />
            <span className="text-[10px] text-slate-500 font-mono">+15°</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setManualSway(-10)}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/60"
            >
              Left Shock
            </button>
            <button
              onClick={() => setManualSway(0)}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/60"
            >
              Reset
            </button>
            <button
              onClick={() => setManualSway(10)}
              className="px-2.5 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700/60"
            >
              Right Shock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
