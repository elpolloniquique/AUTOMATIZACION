import { POLLON_BRAND } from '../../constants/pollonBrand.js';
import { normalizeStoryLinkUrl } from '../stories/storyLinkButtonOverlay.js';

export type FacebookActionButtonType = 'website' | 'whatsapp';

export interface FacebookActionButtonConfig {
  enabled: boolean;
  type: FacebookActionButtonType;
  text: string;
  url?: string | null;
  whatsappMessage?: string | null;
  whatsappPhone?: string | null;
}

export const DEFAULT_WHATSAPP_MESSAGE =
  'Hola, quiero más información sobre sus productos 🍗';

const CTA_TYPE_BY_LABEL: Record<string, string> = {
  Comprar: 'SHOP_NOW',
  'Más información': 'LEARN_MORE',
  Reservar: 'BOOK_TRAVEL',
  Registrarse: 'SIGN_UP',
  Contactar: 'CONTACT_US',
  'Ver menú': 'LEARN_MORE',
  'Pedir ahora': 'SHOP_NOW',
  Ordenar: 'SHOP_NOW',
};

export function resolveFacebookActionLink(config: FacebookActionButtonConfig): string {
  if (config.type === 'whatsapp') {
    return buildWhatsAppActionUrl(
      config.whatsappPhone,
      config.whatsappMessage || DEFAULT_WHATSAPP_MESSAGE,
    );
  }
  return normalizeStoryLinkUrl(config.url);
}

export function buildWhatsAppActionUrl(phoneRaw?: string | null, message?: string | null): string {
  const msg = (message || DEFAULT_WHATSAPP_MESSAGE).trim();
  const digits = (phoneRaw || POLLON_BRAND.whatsappPhone).replace(/\D/g, '');
  const phone = digits.startsWith('56') ? digits : `56${digits.replace(/^0+/, '')}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export function mapButtonTextToCtaType(buttonText: string): string {
  const label = (buttonText || 'Comprar').trim();
  return CTA_TYPE_BY_LABEL[label] || 'SHOP_NOW';
}

export function buildActionCaptionLine(config: FacebookActionButtonConfig): string {
  const label = (config.text || 'Comprar').trim();
  const link = resolveFacebookActionLink(config);
  return `👉 ${label}: ${link}`;
}
