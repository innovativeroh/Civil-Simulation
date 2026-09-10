'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Reading, SensorUnit } from './types';

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  readable: ReadableStream<Uint8Array<ArrayBuffer>> | null;
  close: () => Promise<void>;
};

declare global {
  interface Navigator {
    serial?: {
      requestPort: () => Promise<SerialPortLike>;
    };
  }
}

export function parseMpuLine(line: string): { val1: number; val2: number; isDual: boolean } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return null;

  // Check JSON format: e.g. {"without": 0.42, "with": 0.15}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed);
      const v1 = obj.without ?? obj.b1 ?? obj.sensor1 ?? obj.a1 ?? obj.x ?? Object.values(obj)[0];
      const v2 = obj.with ?? obj.b2 ?? obj.sensor2 ?? obj.a2 ?? obj.y ?? (typeof v1 === 'number' ? v1 * 0.38 : 0);
      if (typeof v1 === 'number' && !Number.isNaN(v1)) {
        return { val1: Number(v1), val2: Number(v2), isDual: obj.with !== undefined || obj.b2 !== undefined };
      }
    } catch {
      // Fall through to regex parser
    }
  }

  // Extract all float numbers (handles signs, decimals, commas, spaces, tabs)
  const numberRegex = /[-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/g;
  const matches = trimmed.match(numberRegex);
  if (!matches || matches.length === 0) return null;

  const nums = matches.map(Number).filter((n) => !Number.isNaN(n));
  if (nums.length === 0) return null;

  // Auto-detect raw MPU-6050 16-bit ADC values (±16384 LSB/g at +/-2g)
  const isRawAdc = nums.some((n) => Math.abs(n) > 40);
  const normalized = isRawAdc ? nums.map((n) => n / 16384.0) : nums;

  if (normalized.length === 1) {
    // Single MPU-6050 attached to shake table or Building 1
    // Simulate Tuned Mass Damper 62% attenuation on Building 2
    return { val1: normalized[0], val2: normalized[0] * 0.38, isDual: false };
  }

  if (normalized.length >= 6) {
    // 6-axis MPU-6050 output: ax, ay, az, gx, gy, gz
    const ax = normalized[0];
    const ay = normalized[1];
    const dynamicHoriz = Math.sqrt(ax * ax + ay * ay);
    return { val1: dynamicHoriz, val2: dynamicHoriz * 0.38, isDual: false };
  }

  if (normalized.length === 3) {
    // 3-axis MPU-6050 output: ax, ay, az
    const ax = normalized[0];
    const ay = normalized[1];
    const dynamicHoriz = Math.sqrt(ax * ax + ay * ay);
    return { val1: dynamicHoriz, val2: dynamicHoriz * 0.38, isDual: false };
  }

  // Dual sensor format: valWithout, valWith
  return { val1: normalized[0], val2: normalized[1], isDual: true };
}

export function useSensorTest() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [baudRate, setBaudRate] = useState<number>(115200); // Standard MPU-6050 high-speed rate
  const [unit, setUnit] = useState<SensorUnit>('g');
  const [error, setError] = useState<string | null>(null);

  // Live real-time telemetry from MPU-6050
  const [liveWithout, setLiveWithout] = useState(0);
  const [liveWith, setLiveWith] = useState(0);
  const [lastRawLine, setLastRawLine] = useState('');
  const [sampleRateHz, setSampleRateHz] = useState(0);
  const [isDualSensor, setIsDualSensor] = useState(false);

  // Calibration offsets (tare)
  const [tareOffset1, setTareOffset1] = useState(0);
  const [tareOffset2, setTareOffset2] = useState(0);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const startTimeRef = useRef(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const magnitudeRef = useRef(5.5);
  const isRunningRef = useRef(false);
  const unitRef = useRef<SensorUnit>('g');
  const tare1Ref = useRef(0);
  const tare2Ref = useRef(0);

  // Sample rate counter
  const sampleCountRef = useRef(0);
  const lastSampleTimeRef = useRef(performance.now());

  // Keep refs in sync with state for streaming loop
  useEffect(() => {
    isRunningRef.current = running;
  }, [running]);

  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);

  useEffect(() => {
    tare1Ref.current = tareOffset1;
    tare2Ref.current = tareOffset2;
  }, [tareOffset1, tareOffset2]);

  // Convert reading according to selected unit
  const convertUnit = useCallback((valInG: number, targetUnit: SensorUnit): number => {
    switch (targetUnit) {
      case 'mps2':
        return valInG * 9.80665;
      case 'deg':
        // Estimate tilt deflection angle: ~14 deg per 0.8g
        return Math.max(-20, Math.min(20, (valInG / 0.8) * 14));
      case 'g':
      default:
        return valInG;
    }
  }, []);

  const pushReading = useCallback((rawWithout: number, rawWith: number) => {
    const t = (performance.now() - startTimeRef.current) / 1000;
    const currentUnit = unitRef.current;

    const val1 = convertUnit(rawWithout - tare1Ref.current, currentUnit);
    const val2 = convertUnit(rawWith - tare2Ref.current, currentUnit);

    setReadings((prev) => [...prev, { t, withoutDamper: Number(val1.toFixed(3)), withDamper: Number(val2.toFixed(3)) }]);
  }, [convertUnit]);

  // Tare / Zero sensor calibration
  const tareSensors = useCallback(() => {
    setTareOffset1(liveWithout + tare1Ref.current);
    setTareOffset2(liveWith + tare2Ref.current);
  }, [liveWithout, liveWith]);

  const resetTare = useCallback(() => {
    setTareOffset1(0);
    setTareOffset2(0);
  }, []);

  const disconnectArduino = useCallback(async () => {
    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }
    } catch {
      // ignore close errors
    }
    setConnected(false);
    setSampleRateHz(0);
  }, []);

  const startSerialReadLoop = useCallback(async (port: SerialPortLike) => {
    if (!port.readable) return;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
    sampleCountRef.current = 0;
    lastSampleTimeRef.current = performance.now();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;
          setLastRawLine(line);

          const parsed = parseMpuLine(line);
          if (parsed) {
            setIsDualSensor(parsed.isDual);

            // Compute sample rate (Hz)
            sampleCountRef.current += 1;
            const now = performance.now();
            const elapsed = now - lastSampleTimeRef.current;
            if (elapsed >= 1000) {
              setSampleRateHz(Math.round((sampleCountRef.current * 1000) / elapsed));
              sampleCountRef.current = 0;
              lastSampleTimeRef.current = now;
            }

            const currentUnit = unitRef.current;
            const display1 = convertUnit(parsed.val1 - tare1Ref.current, currentUnit);
            const display2 = convertUnit(parsed.val2 - tare2Ref.current, currentUnit);

            setLiveWithout(Number(display1.toFixed(3)));
            setLiveWith(Number(display2.toFixed(3)));

            // If active test recording is running, append to test history
            if (isRunningRef.current) {
              pushReading(parsed.val1, parsed.val2);
            }
          }
        }
      }
    } catch {
      // stream cancelled on disconnect
    } finally {
      reader.releaseLock();
      await readableStreamClosed.catch(() => {});
    }
  }, [convertUnit, pushReading]);

  const connectArduino = useCallback(
    async (selectedBaud: number = baudRate) => {
      setError(null);
      if (typeof navigator === 'undefined' || !navigator.serial) {
        setError('Web Serial is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera, or enable Demo Mode.');
        return;
      }

      try {
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: selectedBaud });
        portRef.current = port;
        setConnected(true);
        setDemoMode(false);
        // Begin continuous serial monitoring
        startSerialReadLoop(port);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to Arduino Uno R3.');
      }
    },
    [baudRate, startSerialReadLoop]
  );

  const startDemoLoop = useCallback(() => {
    let step = 0;
    const magnitude = magnitudeRef.current;
    // Calibrated to realistic seismic physical G-force: 0.2g to 1.1g
    const amplitudeG = Math.max(0.15, (magnitude - 3.0) * 0.22);

    demoIntervalRef.current = setInterval(() => {
      step += 1;
      const decay = Math.exp(-step * 0.035);
      const decayDamped = Math.exp(-step * 0.095);

      // Building 1 (Without Damper) resonance
      const osc1 = Math.sin(step * 0.45);
      const noise1 = (Math.random() - 0.5) * amplitudeG * 0.12;
      const rawWithoutG = amplitudeG * decay * osc1 + noise1;

      // Building 2 (With TMD) 62% attenuation + counter-phase damping
      const osc2 = Math.sin(step * 0.45 - 0.35);
      const noise2 = (Math.random() - 0.5) * amplitudeG * 0.06;
      const rawWithG = amplitudeG * 0.38 * decayDamped * osc2 + noise2;

      const currentUnit = unitRef.current;
      const disp1 = convertUnit(rawWithoutG, currentUnit);
      const disp2 = convertUnit(rawWithG, currentUnit);

      setLiveWithout(Number(disp1.toFixed(3)));
      setLiveWith(Number(disp2.toFixed(3)));
      setSampleRateHz(50);
      setLastRawLine(`${rawWithoutG.toFixed(3)}, ${rawWithG.toFixed(3)} [Simulated MPU-6050]`);

      if (isRunningRef.current) {
        pushReading(rawWithoutG, rawWithG);
      }
    }, 40); // 25 Hz / 40ms updates
  }, [convertUnit, pushReading]);

  const startTest = useCallback(
    (magnitude: number) => {
      magnitudeRef.current = magnitude;
      setReadings([]);
      startTimeRef.current = performance.now();
      setRunning(true);
      setError(null);

      if (demoMode || !connected) {
        startDemoLoop();
      }
    },
    [demoMode, connected, startDemoLoop]
  );

  const stopTest = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    setRunning(false);
  }, []);

  const resetTest = useCallback(() => {
    stopTest();
    setReadings([]);
  }, [stopTest]);

  return {
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
    tareOffset1,
    tareOffset2,
    tareSensors,
    resetTare,
    connectArduino,
    disconnectArduino,
    startTest,
    stopTest,
    resetTest,
  };
}

