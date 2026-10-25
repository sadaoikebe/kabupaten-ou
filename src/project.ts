export const WORLD_KM = 40075.017;

export function project(lon: number, lat: number): [number, number] {
  const x = (lon + 180) / 360;
  const phi = (lat * Math.PI) / 180;
  const y = (1 - Math.asinh(Math.tan(phi)) / Math.PI) / 2;
  return [x, y];
}

export function unproject(x: number, y: number): [number, number] {
  const lon = x * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
  return [lon, lat];
}

export function lonLatRing(ring: number[][]): number[][] {
  return ring.map(([lon, lat]) => project(lon, lat));
}
