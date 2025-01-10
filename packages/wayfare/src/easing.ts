export function encroach(
  from: number,
  to: number,
  factorPerSecond: number,
  deltaSeconds: number,
): number {
  const diff = to - from;
  const factor = factorPerSecond ** deltaSeconds;
  return from + diff * (1 - factor);
}
