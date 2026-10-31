import type { IconName, ImageEntry, ImageName, ImageSection } from './types';

/**
 * Manifest for the 18 planned photographs (02_DESIGN_RESEARCH.md Part 3).
 * Files live in apps/web/public/landing/ as .webp (1× plus an `-800` variant).
 * Dimensions are the final CROPPED sizes (what ChatGPT image generation can really deliver):
 *   16:9 → 1536×864 · 3:2 → 1536×1024 · 4:5 → 1024×1280 · 1:1 → 1024×1024
 * Every <img> must render a graceful Ink / Light-Grey fallback box if the file is missing.
 */

type Shape = '16:9' | '3:2' | '4:5' | '1:1';

const SHAPES: Readonly<Record<Shape, { width: number; height: number; ratio: string }>> = {
  '16:9': { width: 1536, height: 864, ratio: '16 / 9' },
  '3:2': { width: 1536, height: 1024, ratio: '3 / 2' },
  '4:5': { width: 1024, height: 1280, ratio: '4 / 5' },
  '1:1': { width: 1024, height: 1024, ratio: '1 / 1' },
};

interface Spec {
  readonly name: ImageName;
  readonly shape: Shape;
  readonly section: ImageSection;
  readonly alt: string;
  readonly alsoUsedIn?: readonly string[];
  readonly decorative?: boolean;
  readonly priority?: boolean;
  readonly fallbackIcon: IconName;
}

const SPECS: readonly Spec[] = [
  {
    name: 'hero-pass-evening',
    shape: '16:9',
    section: 'hero',
    alt: 'A restaurant kitchen pass at dusk: plated dishes under warm heat lamps and a row of blank paper tickets hanging on a rail.',
    alsoUsedIn: ['dashboard venue tile'],
    decorative: true,
    priority: true,
    fallbackIcon: 'UtensilsCrossed',
  },
  {
    name: 'restaurant-dining-golden-hour',
    shape: '3:2',
    section: 'about',
    alt: 'A warm contemporary Indian restaurant at golden hour, window light across wooden tables with empty white plates and pots of green herbs.',
    alsoUsedIn: ['trust room parallax mid layer', 'builtfor ring'],
    fallbackIcon: 'Utensils',
  },
  {
    name: 'boutique-hotel-dining',
    shape: '3:2',
    section: 'builtfor',
    alt: 'Breakfast service about to begin in a boutique hotel restaurant: linen-covered tables, a brass pendant light and a potted palm in morning sun.',
    alsoUsedIn: ['builtfor ring'],
    fallbackIcon: 'Hotel',
  },
  {
    name: 'specialty-cafe-counter',
    shape: '4:5',
    section: 'builtfor',
    alt: 'A specialty coffee café counter with a matte espresso machine, a pour-over set, ceramic cups and a hanging green plant in warm side light.',
    alsoUsedIn: ['builtfor ring'],
    fallbackIcon: 'Coffee',
  },
  {
    name: 'cloud-kitchen-line',
    shape: '3:2',
    section: 'builtfor',
    alt: 'A tidy cloud kitchen prep line in stainless steel with sealed takeaway containers in plain kraft bags and an empty dispatch shelf.',
    alsoUsedIn: ['platform KOS feature', 'builtfor ring'],
    fallbackIcon: 'CookingPot',
  },
  {
    name: 'bakery-morning-display',
    shape: '4:5',
    section: 'builtfor',
    alt: 'A neighbourhood bakery at seven in the morning: a glass display of croissants, buns and brown bread with flour dust in a shaft of sunlight.',
    alsoUsedIn: ['builtfor ring'],
    fallbackIcon: 'Croissant',
  },
  {
    name: 'indian-thali-overhead',
    shape: '1:1',
    section: 'platform',
    alt: 'A Gujarati steel thali seen from above on a dark slate table, with small bowls of dal, kadhi, sabzi, farsan, rice and a green chutney.',
    alsoUsedIn: ['platform menu module', 'builtfor ring'],
    fallbackIcon: 'UtensilsCrossed',
  },
  {
    name: 'rooftop-restaurant-dusk',
    shape: '16:9',
    section: 'cta',
    alt: 'A rooftop restaurant in an Indian city at blue-hour dusk, with string lights and a few candle-lit tables against a blurred skyline.',
    alsoUsedIn: ['builtfor ring'],
    decorative: true,
    fallbackIcon: 'Building2',
  },
  {
    name: 'kitchen-pass-ticket-rail',
    shape: '3:2',
    section: 'platform',
    alt: 'A kitchen order rail above a steel pass with blank paper tickets clipped in a row under a warm heat-lamp glow.',
    alsoUsedIn: ['platform KOS module'],
    fallbackIcon: 'ChefHat',
  },
  {
    name: 'qr-table-tent-blank',
    shape: '4:5',
    section: 'platform',
    alt: 'A blank white card table tent on a wooden restaurant table beside a water glass and a sprig of basil.',
    alsoUsedIn: ['trust room table layer', 'insights QR article'],
    fallbackIcon: 'QrCode',
  },
  {
    name: 'owner-tablet-reports',
    shape: '3:2',
    section: 'platform',
    alt: 'A restaurant owner seen from behind at a corner table after lunch service, holding a tablet beside a cup of chai in warm daylight.',
    alsoUsedIn: ['platform reports module', 'insights'],
    fallbackIcon: 'ChartColumn',
  },
  {
    name: 'table-setting-topdown',
    shape: '1:1',
    section: 'platform',
    alt: 'A perfectly set restaurant table from above: white plate, steel cutlery, linen napkin and a green sprig on dark wood.',
    alsoUsedIn: ['platform floor module', 'preloader-adjacent brand moment'],
    fallbackIcon: 'LayoutGrid',
  },
  {
    name: 'quick-service-counter',
    shape: '3:2',
    section: 'builtfor',
    alt: 'An Indian snack and chai counter in the evening with a steel kettle, a tray of samosas, paper cups and warm bulbs.',
    fallbackIcon: 'Store',
  },
  {
    name: 'bar-pour-evening',
    shape: '4:5',
    section: 'builtfor',
    alt: 'A bartender’s hands pouring a drink into a coupe glass at a craft bar, with amber bokeh and unlabelled bottles behind.',
    alsoUsedIn: ['builtfor ring only'],
    decorative: true,
    fallbackIcon: 'Wine',
  },
  {
    name: 'chef-hands-plating',
    shape: '3:2',
    section: 'compare',
    alt: 'A chef’s hands placing a final green herb leaf on a plated curry on a steel pass, with steam rising in warm light.',
    alsoUsedIn: ['insights wrong-dish article'],
    fallbackIcon: 'ChefHat',
  },
  {
    name: 'restaurant-before-service',
    shape: '3:2',
    section: 'compare',
    alt: 'An empty restaurant at five in the evening before opening, chairs on tables and low golden light through the windows.',
    alsoUsedIn: ['compare 18:00 scene', 'trust room back layer'],
    fallbackIcon: 'Sunset',
  },
  {
    name: 'storeroom-crates-morning',
    shape: '1:1',
    section: 'platform',
    alt: 'A restaurant storeroom in the morning with neat wooden and steel crates of onions, tomatoes, green chillies and herbs.',
    alsoUsedIn: ['platform stock card (coming soon)'],
    fallbackIcon: 'Boxes',
  },
  {
    name: 'closing-counter-lamp',
    shape: '3:2',
    section: 'compare',
    alt: 'A restaurant billing counter after closing with one warm lamp on, a closed laptop and a cup of tea in soft darkness.',
    alsoUsedIn: ['compare 00:00 scene', 'insights fallback cover'],
    fallbackIcon: 'Lamp',
  },
];

const build = (spec: Spec): ImageEntry => {
  const shape = SHAPES[spec.shape];
  return {
    name: spec.name,
    file: `/landing/${spec.name}.webp`,
    file800: `/landing/${spec.name}-800.webp`,
    alt: spec.alt,
    decorative: spec.decorative ?? false,
    width: shape.width,
    height: shape.height,
    ratio: shape.ratio,
    section: spec.section,
    alsoUsedIn: spec.alsoUsedIn ?? [],
    ...(spec.priority ? { priority: true } : {}),
    fallbackIcon: spec.fallbackIcon,
  };
};

/** All 18 images, in manifest order (01–18). */
export const IMAGES: readonly ImageEntry[] = SPECS.map(build);

const BY_NAME: ReadonlyMap<ImageName, ImageEntry> = new Map(IMAGES.map((i) => [i.name, i]));

/** Look up one image by name. Throws on a typo only at runtime; the argument type catches it at compile time. */
export function img(name: ImageName): ImageEntry {
  const entry = BY_NAME.get(name);
  if (!entry) throw new Error(`Unknown landing image: ${name}`);
  return entry;
}

/** srcSet string for the 1× and 800-px variants. */
export function imgSrcSet(name: ImageName): string {
  const i = img(name);
  return `${i.file800} 800w, ${i.file} ${i.width}w`;
}

/** Images belonging to a section (primary use). */
export function imagesFor(section: ImageSection): readonly ImageEntry[] {
  return IMAGES.filter((i) => i.section === section);
}

/** Open Graph / Twitter share image. Brand v2 image, to be produced; the old og.png uses banned greens. */
export const OG_IMAGE = {
  file: '/landing/og-1200x630.png',
  width: 1200,
  height: 630,
  alt: 'Manhar Nexus: a restaurant pass at dusk with tickets lined up.',
} as const;
