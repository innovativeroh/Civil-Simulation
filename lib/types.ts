export interface Reading {
  t: number; // seconds since test start
  withoutDamper: number;
  withDamper: number;
}

export interface MagnitudeResult {
  magnitude: number;
  readings: Reading[];
  peakWithout: number;
  peakWith: number;
  maxVibrationWithout: number;
  maxVibrationWith: number;
  avgWithout: number;
  avgWith: number;
}

export const MAGNITUDES = [4.0, 5.0, 5.5, 6.0, 6.5, 7.0];

export function summarize(magnitude: number, readings: Reading[]): MagnitudeResult {
  const withoutVals = readings.map((r) => r.withoutDamper);
  const withVals = readings.map((r) => r.withDamper);

  const peakWithout = withoutVals.length ? Math.max(...withoutVals) : 0;
  const peakWith = withVals.length ? Math.max(...withVals) : 0;

  // "Maximum Vibration" = peak-to-peak amplitude (max - min)
  const maxVibrationWithout = withoutVals.length
    ? Math.max(...withoutVals) - Math.min(...withoutVals)
    : 0;
  const maxVibrationWith = withVals.length
    ? Math.max(...withVals) - Math.min(...withVals)
    : 0;

  const avgWithout = withoutVals.length
    ? withoutVals.reduce((a, b) => a + b, 0) / withoutVals.length
    : 0;
  const avgWith = withVals.length
    ? withVals.reduce((a, b) => a + b, 0) / withVals.length
    : 0;

  return {
    magnitude,
    readings,
    peakWithout,
    peakWith,
    maxVibrationWithout,
    maxVibrationWith,
    avgWithout,
    avgWith,
  };
}

export function effectiveness(withoutVal: number, withVal: number): number {
  if (!withoutVal) return 0;
  return ((withoutVal - withVal) / withoutVal) * 100;
}
