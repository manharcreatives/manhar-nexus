/** Small pure helpers for the header: environment and user identity display. */

/** Deployment environment: VITE_APP_ENV wins (e.g. "staging" on a production build), else Vite's mode. */
export function appEnvironment(): string {
  const explicit = (import.meta.env.VITE_APP_ENV as string | undefined)?.trim();
  return (explicit || import.meta.env.MODE || 'development').toLowerCase();
}

export function isProductionEnv(env: string): boolean {
  return env === 'production' || env === 'prod';
}

/** Known environments get translated labels; anything else is shown as-is. */
export const KNOWN_ENVS = ['development', 'staging', 'test', 'preview', 'demo'] as const;

/** Up to two initials from a display name, falling back to the email's first letter. */
export function initialsOf(displayName: string | null | undefined, email: string | null | undefined): string {
  const words = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email ?? '?').trim().charAt(0).toUpperCase() || '?';
}
