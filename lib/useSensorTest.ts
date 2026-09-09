'use client';

import { useCallback, useRef, useState } from 'react';
import { Reading } from './types';

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

export function useSensorTest() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [running, setRunning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const startTimeRef = useRef(0);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const magnitudeRef = useRef(5.5);

  const pushReading = useCallback((withoutDamper: number, withDamper: number) => {
    const t = (performance.now() - startTimeRef.current) / 1000;
    setReadings((prev) => [...prev, { t, withoutDamper, withDamper }]);
  }, []);

  const connectArduino = useCallback(async () => {
    setError(null);
    if (!navigator.serial) {
      setError('Web Serial not supported in this browser. Use Chrome/Edge, or use Demo Mode.');
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      setConnected(true);
      setDemoMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Arduino.');
    }
  }, []);

  const disconnectArduino = useCallback(async () => {
    try {
      await readerRef.current?.cancel();
      readerRef.current = null;
      await portRef.current?.close();
      portRef.current = null;
    } catch {
      // ignore close errors
    }
    setConnected(false);
  }, []);

  const readSerialLoop = useCallback(async () => {
    const port = portRef.current;
    if (!port?.readable) return;
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          const parts = line.split(',').map((p) => parseFloat(p.trim()));
          if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
            pushReading(parts[0], parts[1]);
          }
        }
      }
    } catch {
      // stream cancelled
    } finally {
      reader.releaseLock();
      await readableStreamClosed.catch(() => {});
    }
  }, [pushReading]);

  const startDemoLoop = useCallback(() => {
    let step = 0;
    const magnitude = magnitudeRef.current;
    const amplitude = magnitude * 2.2;
    demoIntervalRef.current = setInterval(() => {
      step += 1;
      const decay = Math.exp(-step * 0.04);
      const decayDamped = Math.exp(-step * 0.12);
      const noise1 = (Math.random() - 0.5) * amplitude * 0.15;
      const noise2 = (Math.random() - 0.5) * amplitude * 0.1;
      const withoutDamper = amplitude * decay * Math.sin(step * 0.5) + noise1;
      const withDamper = amplitude * 0.45 * decayDamped * Math.sin(step * 0.5) + noise2;
      pushReading(Number(withoutDamper.toFixed(2)), Number(withDamper.toFixed(2)));
    }, 200);
  }, [pushReading]);

  const startTest = useCallback(
    (magnitude: number) => {
      magnitudeRef.current = magnitude;
      setReadings([]);
      startTimeRef.current = performance.now();
      setRunning(true);
      setError(null);
      if (demoMode || !connected) {
        startDemoLoop();
      } else {
        readSerialLoop();
      }
    },
    [demoMode, connected, startDemoLoop, readSerialLoop]
  );

  const stopTest = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
    readerRef.current?.cancel().catch(() => {});
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
    error,
    connectArduino,
    disconnectArduino,
    startTest,
    stopTest,
    resetTest,
  };
}
