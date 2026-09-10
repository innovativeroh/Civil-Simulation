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
import { MAGNITUDES, SensorUnit } from '@/lib/types';
import { useSensorTest } from '@/lib/useSensorTest';
import { Buildings } from './Buildings';

const ARDUINO_SKETCH_CODE = `/*
  Civil Engineering Seismic Simulation — Arduino Uno R3 + MPU-6050 Interface
  Compatible with:
    - Arduino Uno R3 (ATmega328P)
    - MPU-6050 (GY-521) 3-Axis Accelerometer & Gyroscope
    - Dual Sensor Mode: Building 1 (0x68) + Building 2 (0x69)
    - Single Sensor Mode: Auto-fallback if only 1 MPU-6050 is connected
*/
#include <Wire.h>

const uint8_t MPU_ADDR_1 = 0x68; // Sensor 1 (AD0 -> GND)
const uint8_t MPU_ADDR_2 = 0x69; // Sensor 2 (AD0 -> 5V/3.3V)
const float ACCEL_SCALE = 16384.0; // +/- 2g sensitivity

bool sensor1_ok = false;
bool sensor2_ok = false;
float off1_x = 0, off1_y = 0;
float off2_x = 0, off2_y = 0;
float filtered1 = 0.0, filtered2 = 0.0;

bool initMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  if (Wire.endTransmission() != 0) return false;
  Wire.beginTransmission(addr);
  Wire.write(0x6B); // PWR_MGMT_1
  Wire.write(0x00); // Wake up
  Wire.endTransmission();
  return true;
}

bool readAccel(uint8_t addr, float &ax, float &ay) {
  Wire.beginTransmission(addr);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  Wire.requestFrom((int)addr, 4, (int)true);
  if (Wire.available() < 4) return false;
  int16_t rx = (Wire.read() << 8) | Wire.read();
  int16_t ry = (Wire.read() << 8) | Wire.read();
  ax = (float)rx / ACCEL_SCALE;
  ay = (float)ry / ACCEL_SCALE;
  return true;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Wire.setClock(400000); // 400kHz Fast I2C
  delay(100);
  sensor1_ok = initMPU(MPU_ADDR_1);
  sensor2_ok = initMPU(MPU_ADDR_2);
  // Zero-calibration (take 50 baseline samples)
  for (int i = 0; i < 50; i++) {
    float x, y;
    if (sensor1_ok && readAccel(MPU_ADDR_1, x, y)) { off1_x += x; off1_y += y; }
    if (sensor2_ok && readAccel(MPU_ADDR_2, x, y)) { off2_x += x; off2_y += y; }
    delay(10);
  }
  off1_x /= 50.0; off1_y /= 50.0;
  off2_x /= 50.0; off2_y /= 50.0;
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last >= 20) { // 50 Hz streaming
    last = millis();
    float x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    float r1 = 0, r2 = 0;

    if (sensor1_ok && readAccel(MPU_ADDR_1, x1, y1)) {
      float dx = x1 - off1_x;
      float dy = y1 - off1_y;
      r1 = sqrt(dx*dx + dy*dy);
      if (dx < 0) r1 = -r1;
    }
    if (sensor2_ok && readAccel(MPU_ADDR_2, x2, y2)) {
      float dx = x2 - off2_x;
      float dy = y2 - off2_y;
      r2 = sqrt(dx*dx + dy*dy);
      if (dx < 0) r2 = -r2;
    } else {
      r2 = r1 * 0.38; // Simulated 62% TMD attenuation if 1 sensor
    }

    filtered1 = 0.85 * filtered1 + 0.15 * r1;
    filtered2 = 0.85 * filtered2 + 0.15 * r2;

    Serial.print(filtered1, 3);
    Serial.print(",");
    Serial.println(filtered2, 3);
  }
}`;

export function LiveGraph({
  onTestComplete,
}: {
  onTestComplete: (magnitude: number, readings: { t: number; withoutDamper: number; withDamper: number }[]) => void;
}) {
  const [magnitude, setMagnitude] = useState(5.5);
  const [showGuide, setShowGuide] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    readings,
    running,
    connected,
    demoMode,
    setDemoMode,
    baudRate,
    setBaudRate,
    unit,
    setUnit,
    error,
    liveWithout,
    liveWith,
    lastRawLine,
    sampleRateHz,
    isDualSensor,
    tareSensors,
    resetTare,
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
  const displayWithout = running ? (latest ? latest.withoutDamper : liveWithout) : liveWithout;
  const displayWith = running ? (latest ? latest.withDamper : liveWith) : liveWith;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ARDUINO_SKETCH_CODE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked
    }
  };

  const getUnitLabel = (u: SensorUnit) => {
    switch (u) {
      case 'mps2': return 'Acceleration (m/s²)';
      case 'deg': return 'Sway Angle (°)';
      case 'g': default: return 'Seismic Force (g)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Configuration & Hardware Toolbar */}
      <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Earthquake Magnitude Buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Magnitude:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {MAGNITUDES.map((m) => (
                <button
                  key={m}
                  disabled={running}
                  onClick={() => setMagnitude(m)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    magnitude === m
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                      : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-amber-500'
                  } disabled:opacity-40`}
                >
                  M{m.toFixed(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Unit Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Sensor Unit:
            </span>
            <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
              {(['g', 'mps2', 'deg'] as SensorUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
                    unit === u
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {u === 'g' ? 'g (Seismic)' : u === 'mps2' ? 'm/s²' : '° (Tilt)'}
                </button>
              ))}
            </div>
          </div>

          {/* Guide & Terminal Modals */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/50 flex items-center gap-1.5 transition"
            >
              <span>🔌</span> Arduino & MPU-6050 Guide
            </button>
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition ${
                showTerminal
                  ? 'bg-cyan-950/70 border-cyan-500 text-cyan-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              💻 Serial Monitor
            </button>
          </div>
        </div>

        {/* Connection Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={demoMode}
                disabled={running}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="accent-amber-500 w-4 h-4 rounded"
              />
              <span className="text-xs font-semibold">Demo Simulation Mode</span>
            </label>

            {!demoMode && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Baud:</span>
                <select
                  value={baudRate}
                  disabled={connected || running}
                  onChange={(e) => setBaudRate(Number(e.target.value))}
                  className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-md px-2 py-1 disabled:opacity-50"
                >
                  <option value={115200}>115200 (MPU-6050 Fast)</option>
                  <option value={9600}>9600 (Standard)</option>
                  <option value={57600}>57600</option>
                  <option value={38400}>38400</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {!demoMode &&
              (connected ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/70 text-emerald-400 border border-emerald-700/50 text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Arduino Uno R3 Connected {sampleRateHz > 0 && `(${sampleRateHz} Hz)`}
                  </span>
                  <button
                    onClick={tareSensors}
                    title="Calibrate current sensor reading to zero baseline"
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-700/50 transition"
                  >
                    ⚖️ Tare / Zero
                  </button>
                  <button
                    onClick={disconnectArduino}
                    className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-800 transition"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => connectArduino(baudRate)}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-950/40 transition"
                >
                  ⚡ Connect Arduino Uno R3
                </button>
              ))}
          </div>
        </div>

        {/* Live Serial Stream Monitor */}
        {showTerminal && (
          <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-slate-800/80">
              <span className="text-cyan-400 font-semibold">Live Serial Terminal (MPU-6050 Telemetry)</span>
              <span>
                Status: {connected ? '🟢 Stream Active' : demoMode ? '🟠 Demo Stream' : '⚪ Disconnected'} |{' '}
                {isDualSensor ? 'Dual MPU-6050 (0x68 + 0x69)' : 'Single MPU-6050 (0x68)'} | {sampleRateHz} Hz
              </span>
            </div>
            <div className="text-slate-300 flex items-baseline gap-2">
              <span className="text-slate-500 select-none">&gt;</span>
              <span className="text-emerald-400">
                {lastRawLine || 'Waiting for serial packets from Arduino Uno R3...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-xs px-4 py-2.5 flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Start / Stop / Reset Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => startTest(magnitude)}
          disabled={running || (!demoMode && !connected)}
          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-semibold text-sm shadow-md shadow-emerald-950/50 transition"
        >
          ▶ Start Test Recording
        </button>
        <button
          onClick={handleStop}
          disabled={!running}
          className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-semibold text-sm shadow-md shadow-rose-950/50 transition"
        >
          ■ Stop & Save Test
        </button>
        <button
          onClick={resetTest}
          disabled={running}
          className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-medium text-sm border border-slate-700 transition"
        >
          ↺ Reset Graph
        </button>

        <div className="ml-auto text-xs text-slate-400 flex items-center gap-2">
          <span>Current Live Status:</span>
          <span className={`font-mono font-bold ${running ? 'text-amber-400' : 'text-slate-300'}`}>
            {running ? 'RECORDING TEST' : connected ? 'MONITORING SENSORS' : demoMode ? 'DEMO IDLE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* 3D Claymorphic Buildings Side-by-Side Simulation */}
      <Buildings
        withoutDamper={displayWithout}
        withDamper={displayWith}
        running={running}
        magnitude={magnitude}
        unit={unit}
        sampleRateHz={sampleRateHz}
        isDualSensor={isDualSensor}
      />

      {/* Live Graph */}
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
              label={{
                value: getUnitLabel(unit),
                angle: -90,
                position: 'insideLeft',
                fill: '#64748b',
              }}
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

      {/* Modal: Arduino Uno R3 & MPU-6050 Wiring & Firmware Guide */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔌</span>
                <h3 className="text-lg font-bold text-slate-100">
                  Arduino Uno R3 + MPU-6050 Connection Guide
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <p>
                The MPU-6050 communicates with Arduino Uno R3 via the <strong>I2C interface</strong> (pins A4 and A5). You can connect either a <strong>Single Sensor</strong> or <strong>Dual Sensors</strong> (to measure both buildings simultaneously).
              </p>

              <div className="rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/80 px-3 py-2 font-semibold text-slate-200">
                  Arduino Uno R3 Pinout Wiring
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/40 text-slate-400">
                    <tr>
                      <th className="p-2.5">MPU-6050 Pin</th>
                      <th className="p-2.5">Arduino Uno R3 Pin</th>
                      <th className="p-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr>
                      <td className="p-2.5 font-mono text-amber-400 font-bold">VCC</td>
                      <td className="p-2.5 font-mono text-emerald-400 font-bold">5V (or 3.3V)</td>
                      <td className="p-2.5 text-slate-400">Powers onboard 3.3V regulator</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-amber-400 font-bold">GND</td>
                      <td className="p-2.5 font-mono text-emerald-400 font-bold">GND</td>
                      <td className="p-2.5 text-slate-400">Common Ground</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-amber-400 font-bold">SDA</td>
                      <td className="p-2.5 font-mono text-emerald-400 font-bold">A4</td>
                      <td className="p-2.5 text-slate-400">I2C Serial Data (shared bus)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-amber-400 font-bold">SCL</td>
                      <td className="p-2.5 font-mono text-emerald-400 font-bold">A5</td>
                      <td className="p-2.5 text-slate-400">I2C Serial Clock (shared bus)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-amber-400 font-bold">AD0 (Sensor 1)</td>
                      <td className="p-2.5 font-mono text-emerald-400">GND</td>
                      <td className="p-2.5 text-slate-400">Sets address to 0x68 (Building 1)</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-mono text-amber-400 font-bold">AD0 (Sensor 2)</td>
                      <td className="p-2.5 font-mono text-emerald-400">5V or 3.3V</td>
                      <td className="p-2.5 text-slate-400">Sets address to 0x69 (Building 2)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">
                    Arduino Uno R3 Sketch (No external libraries required):
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition"
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Arduino Sketch'}
                  </button>
                </div>
                <pre className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-52 overflow-y-auto">
                  {ARDUINO_SKETCH_CODE}
                </pre>
              </div>

              <div className="rounded-lg bg-amber-950/30 border border-amber-800/40 p-3 text-amber-300 text-[11px] space-y-1">
                <div className="font-bold">💡 Quick Tips:</div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                  <li>Use Google Chrome, Microsoft Edge, or Opera for Web Serial support.</li>
                  <li>Close the Arduino IDE Serial Monitor before clicking "Connect Arduino" in the browser.</li>
                  <li>Click <strong>Tare / Zero</strong> on the toolbar once connected to calibrate zero-g resting offset.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

