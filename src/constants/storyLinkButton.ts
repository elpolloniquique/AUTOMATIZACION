export const STORY_LINK_BUTTON_LABELS = [
  'Comprar',
  'Más información',
  'Reservar',
  'Registrarse',
  'Contactar',
  'Ver menú',
  'Pedir ahora',
  'Ordenar',
] as const;

export const DEFAULT_STORY_LINK_URL = 'https://www.el-pollon.cl/';

export function normalizeStoryLinkUrl(raw?: string | null): string {
  if (!raw?.trim()) return DEFAULT_STORY_LINK_URL;
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/\//, '')}`;
  try {
    return new URL(url).href;
  } catch {
    return DEFAULT_STORY_LINK_URL;
  }
}

export function resolveBranchWebsiteUrl(branchWebsite?: string | null): string {
  return normalizeStoryLinkUrl(branchWebsite || undefined);
}
