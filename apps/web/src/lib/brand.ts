/**
 * Rebrand configuration. Override at build time with VITE_BRAND_NAME and
 * VITE_BRAND_ACCENT; the accent is applied to the CSS tokens at startup.
 */
export interface Brand {
  name: string;
  accent: string | null;
}

const DEFAULT_NAME = 'Manhar Nexus';

export const brand: Brand = {
  name: import.meta.env.VITE_BRAND_NAME ?? DEFAULT_NAME,
  accent: import.meta.env.VITE_BRAND_ACCENT ?? null,
};

/** True when no rebrand is configured: the drawn monogram and italic wordmark apply. */
export const isDefaultBrand = brand.name === DEFAULT_NAME;

export function applyBrand(): void {
  document.title = brand.name;
  if (brand.accent) {
    const root = document.documentElement.style;
    root.setProperty('--color-accent', brand.accent);
    root.setProperty('--color-accent-strong', `color-mix(in srgb, ${brand.accent} 78%, black)`);
    root.setProperty('--color-accent-soft', `color-mix(in srgb, ${brand.accent} 14%, white)`);
  }
}
