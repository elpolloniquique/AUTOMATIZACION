export interface GalleryItem {
  id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  tags: string[];
  dish_type: string | null;
  file_path: string;
  public_url: string;
  source: string;
  is_active: boolean;
}

export interface MatchInput {
  title: string;
  caption?: string;
  postType?: string;
  branchId?: string;
}

export interface MatchResult {
  item: GalleryItem;
  score: number;
  reason: string;
}

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'en', 'y', 'o', 'a', 'por', 'con',
  'para', 'tu', 'tu', 'que', 'es', 'al', 'se', 'lo', 'muy', 'mas', 'más', 'todo', 'toda',
]);

const POST_TYPE_KEYWORDS: Record<string, string[]> = {
  oferta: ['oferta', 'familiar', 'familia', 'combo', 'promo', 'promocion'],
  combo: ['combo', 'dos', 'pareja', 'duo', 'compartir'],
  delivery: ['delivery', 'domicilio', 'envio', 'envío', 'rapido', 'rápido', 'llega'],
  promocion: ['promo', 'promocion', 'promoción', 'oferta', 'descuento', 'fin', 'semana'],
  producto_destacado: ['destacado', 'estrella', 'plato', 'pollo', 'brasa', 'especial'],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function uniqueTokens(...parts: (string | undefined)[]): Set<string> {
  const all = parts.flatMap((p) => (p ? tokenize(p) : []));
  return new Set(all);
}

function overlapScore(query: Set<string>, target: Set<string>): number {
  if (query.size === 0 || target.size === 0) return 0;
  let hits = 0;
  for (const q of query) {
    for (const t of target) {
      if (t.includes(q) || q.includes(t)) hits++;
    }
  }
  return hits;
}

export function scoreGalleryItem(item: GalleryItem, input: MatchInput): { score: number; reason: string } {
  const queryTokens = uniqueTokens(input.title, input.caption, input.postType);
  const titleTokens = new Set(tokenize(item.title));
  const descTokens = new Set(tokenize(item.description || ''));
  const tagTokens = new Set((item.tags || []).flatMap((t) => tokenize(t)));

  let score = 0;
  const reasons: string[] = [];

  const titleHits = overlapScore(queryTokens, titleTokens);
  if (titleHits > 0) {
    score += titleHits * 12;
    reasons.push(`título (${titleHits})`);
  }

  const tagHits = overlapScore(queryTokens, tagTokens);
  if (tagHits > 0) {
    score += tagHits * 8;
    reasons.push(`etiquetas (${tagHits})`);
  }

  const descHits = overlapScore(queryTokens, descTokens);
  if (descHits > 0) {
    score += descHits * 4;
    reasons.push(`descripción (${descHits})`);
  }

  if (item.dish_type && input.postType && item.dish_type === input.postType) {
    score += 25;
    reasons.push('tipo de plato');
  }

  const typeKeywords = input.postType ? POST_TYPE_KEYWORDS[input.postType] || [] : [];
  for (const kw of typeKeywords) {
    const nkw = normalize(kw);
    if (titleTokens.has(nkw) || tagTokens.has(nkw)) {
      score += 6;
      reasons.push(`keyword ${kw}`);
    }
  }

  const normalizedTitle = normalize(input.title);
  const normalizedItemTitle = normalize(item.title);
  if (normalizedTitle && normalizedItemTitle && (
    normalizedTitle.includes(normalizedItemTitle) ||
    normalizedItemTitle.includes(normalizedTitle)
  )) {
    score += 30;
    reasons.push('coincidencia directa');
  }

  return {
    score,
    reason: reasons.length ? reasons.join(', ') : 'coincidencia baja',
  };
}

export function matchBestGalleryItem(items: GalleryItem[], input: MatchInput): MatchResult | null {
  const active = items.filter((i) => i.is_active);
  if (active.length === 0) return null;

  const ranked = active
    .map((item) => {
      const { score, reason } = scoreGalleryItem(item, input);
      return { item, score, reason };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 4) return ranked[0] ?? null;

  return best;
}

export function matchTopGalleryItems(items: GalleryItem[], input: MatchInput, limit = 3): MatchResult[] {
  return items
    .filter((i) => i.is_active)
    .map((item) => {
      const { score, reason } = scoreGalleryItem(item, input);
      return { item, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
