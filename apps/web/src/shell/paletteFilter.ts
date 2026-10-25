/**
 * Command palette ranking (pure). Each item has a label and optional keywords;
 * the query is matched against both, best matches first, ties keep the original
 * (navigation) order so an empty query lists everything as the sidebar does.
 */

export interface PaletteItemLike {
  id: string;
  label: string;
  keywords?: string;
}

/** Lowercase and strip diacritics so "cafe" finds "Café". */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

/** Higher is better; 0 means no match. */
export function scoreItem(item: PaletteItemLike, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const label = normalize(item.label);
  const words = label.split(/[\s&/·-]+/).filter(Boolean);
  const keywords = normalize(item.keywords ?? '').split(/\s+/).filter(Boolean);
  const terms = q.split(/\s+/).filter(Boolean);

  // Every term must match somewhere; the item's score is its weakest term.
  let total = Infinity;
  for (const term of terms) {
    let s = 0;
    if (label === term) s = 100;
    else if (label.startsWith(term)) s = 80;
    else if (words.some((w) => w.startsWith(term))) s = 60;
    else if (keywords.some((k) => k.startsWith(term))) s = 45;
    else if (label.includes(term)) s = 35;
    else if (keywords.some((k) => k.includes(term))) s = 25;
    else if (term.length > 1 && isSubsequence(term, label.replace(/\s+/g, ''))) s = 10;
    if (s === 0) return 0;
    total = Math.min(total, s);
  }
  return total;
}

export function filterItems<T extends PaletteItemLike>(items: readonly T[], query: string): T[] {
  return items
    .map((item, index) => ({ item, index, score: scoreItem(item, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.item);
}
