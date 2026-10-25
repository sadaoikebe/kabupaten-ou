/** 描いた線と正解の県境が、どれだけ近いか。海上の点は呼び出し側で除く。 */

import { WORLD_KM } from "./project.ts";

export const TOLERANCE_KM = 20;
const CLOSE_KM = 3;
const SAMPLE_KM = 0.5;
const REDRAW_ALLOWANCE = 1.25;

export interface Score {
  percent: number;
  points: number;
  precision: number;
  coverage: number;
}

interface Sample {
  x: number;
  y: number;
  km: number;
}

function kmPerWorld(y: number): number {
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * y)));
  return WORLD_KM * Math.cos(lat);
}

export function lineLength(points: number[][]): number {
  let km = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    km += Math.hypot(b[0] - a[0], b[1] - a[1]) * kmPerWorld((a[1] + b[1]) / 2);
  }
  return km;
}

function resample(lines: number[][][], stepKm: number): Sample[] {
  const samples: Sample[] = [];
  for (const points of lines) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const km = Math.hypot(b[0] - a[0], b[1] - a[1]) * kmPerWorld((a[1] + b[1]) / 2);
      if (km < 1e-6) continue;
      const pieces = Math.max(1, Math.ceil(km / stepKm));
      for (let s = 0; s < pieces; s++) {
        const t = (s + 0.5) / pieces;
        samples.push({
          x: a[0] + (b[0] - a[0]) * t,
          y: a[1] + (b[1] - a[1]) * t,
          km: km / pieces,
        });
      }
    }
  }
  return samples;
}

function closeness(distanceKm: number): number {
  if (distanceKm <= CLOSE_KM) return 1;
  if (distanceKm >= TOLERANCE_KM) return 0;
  const fade = (distanceKm - CLOSE_KM) / (TOLERANCE_KM - CLOSE_KM);
  return (1 - fade) * (1 - fade);
}

function nearestKm(point: Sample, buckets: Map<string, Sample[]>, cell: number): number {
  const cx = Math.floor(point.x / cell);
  const cy = Math.floor(point.y / cell);
  const scale = kmPerWorld(point.y);
  let best = TOLERANCE_KM;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const list = buckets.get(`${cx + dx}:${cy + dy}`);
      if (!list) continue;
      for (const other of list) {
        const distance = Math.hypot(point.x - other.x, point.y - other.y) * scale;
        if (distance < best) best = distance;
      }
    }
  }
  return best;
}

function bucketize(samples: Sample[], cell: number): Map<string, Sample[]> {
  const buckets = new Map<string, Sample[]>();
  for (const sample of samples) {
    const key = `${Math.floor(sample.x / cell)}:${Math.floor(sample.y / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(sample);
    else buckets.set(key, [sample]);
  }
  return buckets;
}

function weightedCloseness(from: Sample[], against: Map<string, Sample[]>, cell: number): { sum: number; km: number } {
  let sum = 0;
  let km = 0;
  for (const sample of from) {
    km += sample.km;
    sum += sample.km * closeness(nearestKm(sample, against, cell));
  }
  return { sum, km };
}

export function scoreDrawing(strokes: number[][][], borders: { points: number[][] }[]): Score {
  const blank = { percent: 0, points: 0, precision: 0, coverage: 0 };
  const target = resample(borders.map((border) => border.points), SAMPLE_KM);
  const drawn = resample(strokes, SAMPLE_KM);
  if (!target.length || !drawn.length) return blank;

  const cell = TOLERANCE_KM / WORLD_KM;
  const targetBuckets = bucketize(target, cell);
  const drawnBuckets = bucketize(drawn, cell);
  const drawnScore = weightedCloseness(drawn, targetBuckets, cell);
  const targetScore = weightedCloseness(target, drawnBuckets, cell);
  if (drawnScore.km <= 0 || targetScore.km <= 0) return blank;

  const precision = drawnScore.sum / drawnScore.km;
  const coverage = targetScore.sum / targetScore.km;
  const coveredKm = coverage * targetScore.km;
  const ink = Math.min(1, (coveredKm * REDRAW_ALLOWANCE) / drawnScore.km);
  const match = Math.min(1, Math.max(0, precision * coverage * ink));
  return {
    percent: Math.round(match * 1000) / 10,
    points: Math.round(match * 100000),
    precision: precision * 100,
    coverage: coverage * 100,
  };
}
