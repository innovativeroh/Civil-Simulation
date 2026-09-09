'use client';

import { useCallback, useEffect, useState } from 'react';
import { MagnitudeResult, Reading, summarize } from './types';

const STORAGE_KEY = 'eri-magnitude-results';

export function useResultsStore() {
  const [results, setResults] = useState<Record<number, MagnitudeResult>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setResults(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const saveResult = useCallback((magnitude: number, readings: Reading[]) => {
    const summary = summarize(magnitude, readings);
    setResults((prev) => {
      const next = { ...prev, [magnitude]: summary };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { results, saveResult };
}
