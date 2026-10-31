export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
