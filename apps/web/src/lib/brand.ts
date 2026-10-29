/**
 * Rebrand configuration. Override at build time with VITE_BRAND_NAME,
 * VITE_BRAND_ACCENT and VITE_BRAND_FOOTNOTE; each restaurant can also pick its
 * own accent colour at runtime (Restaurant profile), applied after sign-in.
 */
export interface Brand {
  name: string;
  accent: string | null;
  /** Login-panel footnote. null = the default ("A Manhar Creatives product"); an empty string hides it. */
  footnote: string | null;
}

const DEFAULT_NAME = 'Manhar Nexus';

export const brand: Brand = {
  name: import.meta.env.VITE_BRAND_NAME ?? DEFAULT_NAME,
  accent: import.meta.env.VITE_BRAND_ACCENT ?? null,
  footnote: (import.meta.env.VITE_BRAND_FOOTNOTE as string | undefined) ?? null,
};

/** True when no rebrand is configured: the drawn monogram and italic wordmark apply. */
export const isDefaultBrand = brand.name === DEFAULT_NAME;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** "#22c55e" -> [34, 197, 94]; null when it is not a 6-digit hex colour. */
export function hexToRgb(hex: string): [number, number, number] | null {
  if (!HEX.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Applies an accent colour to the design tokens (all glows, gradients and buttons
 * derive from them). Text on the accent flips to white when the colour is dark.
 * `null` or an invalid value restores the default green.
 */
export function applyAccent(hex: string | null): void {
  const root = document.documentElement.style;
  const rgb = hex ? hexToRgb(hex) : null;
  if (!hex || !rgb) {
    for (const k of ['--color-accent', '--color-accent-strong', '--color-accent-soft', '--color-ember-glow', '--color-on-accent', '--accent-rgb', '--accent-glow-rgb']) root.removeProperty(k);
    return;
  }
  root.setProperty('--color-accent', hex);
  root.setProperty('--color-accent-strong', `color-mix(in srgb, ${hex} 62%, white)`);
  root.setProperty('--color-ember-glow', `color-mix(in srgb, ${hex} 62%, white)`);
  root.setProperty('--color-accent-soft', `color-mix(in srgb, ${hex} 16%, #0f1513)`);
  root.setProperty('--color-on-accent', luminance(rgb) > 0.4 ? '#04120a' : '#ffffff');
  root.setProperty('--accent-rgb', rgb.join(' '));
  const glow = rgb.map((c) => Math.round(c + (255 - c) * 0.38));
  root.setProperty('--accent-glow-rgb', glow.join(' '));
}

export function applyBrand(): void {
  document.title = brand.name;
  if (brand.accent) applyAccent(brand.accent);
}
