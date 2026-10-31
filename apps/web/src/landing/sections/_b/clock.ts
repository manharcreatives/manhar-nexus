/** Time helpers for the 18:00 -> 00:00 night. `t` = minutes after 18:00 (0..360). */
export interface ClockReading {
  /** 24h stamp, '19:42'. The end of the night reads '00:00'. */
  clock: string;
  /** Spoken / friendly label, '7:42 pm' or 'midnight'. */
  label: string;
}

export function readClock(t: number, startHour = 18): ClockReading {
  const total = startHour * 60 + Math.round(t);
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const clock = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (h24 === 0 && m === 0) return { clock, label: 'midnight' };
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { clock, label: `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}` };
}

/** Index of the latest moment that has already happened at time `t` (0 before the first one). */
export function currentMoment(minutes: readonly number[], t: number): number {
  let cur = 0;
  minutes.forEach((m, i) => {
    if (m <= t) cur = i;
  });
  return cur;
}
