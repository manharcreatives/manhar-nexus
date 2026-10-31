import type { PreloaderContent } from './types';

/**
 * "Kitchen Printer" preloader. Lines print one by one; the whole sequence is
 * capped at 1.7 s and is skipped on reduced motion and on a second visit.
 */
export const PRELOADER: PreloaderContent = {
  lines: [
    'Laying the tables…',
    'Firing the first ticket…',
    'Counting the drawer twice…',
    'Opening for service.',
  ],
  stepMs: 400,
  maxMs: 1700,
  ariaLabel: 'Loading Manhar Nexus',
};

export const PRELOADER_LINES: readonly string[] = PRELOADER.lines;
