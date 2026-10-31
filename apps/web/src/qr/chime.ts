/**
 * Audible alerts for the guest-order inbox, synthesised with the Web Audio API (no asset).
 * Browsers only allow audio after a user gesture: unlockAudio() is called from the first
 * click/key press anywhere in the app, and playChime() reports whether it could sound.
 * The on/off preference is a per-device convenience kept in localStorage (never required).
 */
type AudioCtor = typeof AudioContext;
let ctx: AudioContext | null = null;

function getCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ?? null;
}

/** Creates/resumes the audio context. Call from a user-gesture handler; resolves true once it can sound. */
export async function unlockAudio(): Promise<boolean> {
  try {
    const Ctor = getCtor();
    if (!Ctor) return false;
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx.state === 'running';
  } catch {
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  return ctx?.state === 'running';
}

export type ChimeKind = 'order' | 'call';

const NOTES: Record<ChimeKind, number[]> = {
  order: [880, 1174.66], // A5 -> D6, a friendly two-note "ding-ding"
  call: [659.25, 659.25, 880], // E5 E5 A5, more insistent
};

/** Plays the chime; returns false when audio is locked or unavailable (the UI then shows a hint). */
export function playChime(kind: ChimeKind = 'order'): boolean {
  try {
    if (!ctx || ctx.state !== 'running') return false;
    const now = ctx.currentTime;
    NOTES[kind].forEach((freq, i) => {
      const t0 = now + i * 0.16;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t0);
      osc.stop(t0 + 0.75);
    });
    return true;
  } catch {
    return false;
  }
}

const PREF_KEY = 'nx.qr.sound';

/** Sound is on unless the person muted it on this device. */
export function getSoundPref(): boolean {
  try {
    return window.localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundPref(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(PREF_KEY);
    else window.localStorage.setItem(PREF_KEY, 'off');
  } catch {
    /* storage blocked: the choice just lasts for this page view */
  }
}

/** Test seam. */
export function __resetChimeForTests(): void {
  ctx = null;
}
