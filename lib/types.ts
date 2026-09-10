export interface Reading {
  t: number; // seconds since test start
  withoutDamper: number;
  withDamper: number;
}

export type SensorUnit = 'g' | 'mps2' | 'deg';

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

  const peakWithout = withoutVals.length ? Math.max(...withoutVals.map(Math.abs)) : 0;
  const peakWith = withVals.length ? Math.max(...withVals.map(Math.abs)) : 0;

  // "Maximum Vibration" = peak-to-peak amplitude (max - min)
  const maxVibrationWithout = withoutVals.length
    ? Math.max(...withoutVals) - Math.min(...withoutVals)
    : 0;
  const maxVibrationWith = withVals.length
    ? Math.max(...withVals) - Math.min(...withVals)
    : 0;

  const avgWithout = withoutVals.length
    ? withoutVals.reduce((a, b) => a + Math.abs(b), 0) / withoutVals.length
    : 0;
  const avgWith = withVals.length
    ? withVals.reduce((a, b) => a + Math.abs(b), 0) / withVals.length
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
  if (!withoutVal || withoutVal <= 0) return 0;
  return Math.max(0, Math.min(100, ((withoutVal - withVal) / withoutVal) * 100));
}

// Seismic Peak Ground Acceleration (PGA) intensity classification based on USGS ShakeMap & MPU-6050
export function getSeismicIntensity(gForce: number): {
  label: string;
  color: string;
  badgeBg: string;
  description: string;
} {
  const absG = Math.abs(gForce);
  if (absG < 0.05) {
    return {
      label: 'Light / Microseismic',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/60 border-emerald-700/50',
      description: 'Minor vibration, structural stress negligible',
    };
  }
  if (absG < 0.18) {
    return {
      label: 'Moderate Shaking',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/60 border-amber-700/50',
      description: 'Noticeable oscillation, minor elastic sway',
    };
  }
  if (absG < 0.40) {
    return {
      label: 'Strong Shaking',
      color: 'text-orange-400',
      badgeBg: 'bg-orange-950/60 border-orange-700/50',
      description: 'Substantial lateral inertial forces',
    };
  }
  if (absG < 0.75) {
    return {
      label: 'Very Strong / Severe',
      color: 'text-rose-400',
      badgeBg: 'bg-rose-950/80 border-rose-600/60',
      description: 'Critical structural stress threshold',
    };
  }
  return {
    label: 'Violent / Extreme Shaking',
    color: 'text-red-500',
    badgeBg: 'bg-red-950/90 border-red-500',
    description: 'Severe structural damage without damping',
  };
}

