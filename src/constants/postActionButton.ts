import { POLLON_CONTACT } from './pollonBrand';
import { DEFAULT_STORY_LINK_URL, normalizeStoryLinkUrl, resolveBranchWebsiteUrl, STORY_LINK_BUTTON_LABELS } from './storyLinkButton';

export const POST_ACTION_BUTTON_LABELS = STORY_LINK_BUTTON_LABELS;

export const DEFAULT_WHATSAPP_MESSAGE =
  'Hola, quiero más información sobre sus productos 🍗';

export function defaultPostActionButton(branchWebsite?: string | null) {
  return {
    action_button_enabled: true,
    action_button_type: 'website' as const,
    action_button_text: 'Comprar',
    action_button_url: resolveBranchWebsiteUrl(branchWebsite),
    action_button_whatsapp_message: DEFAULT_WHATSAPP_MESSAGE,
  };
}

export function buildWhatsAppPreviewUrl(
  phone?: string | null,
  message = DEFAULT_WHATSAPP_MESSAGE,
): string {
  const digits = (phone || '+56986925310').replace(/\D/g, '');
  const full = digits.startsWith('56') ? digits : `56${digits}`;
  return `https://wa.me/${full}?text=${encodeURIComponent(message)}`;
}

export { DEFAULT_STORY_LINK_URL, normalizeStoryLinkUrl, resolveBranchWebsiteUrl, POLLON_CONTACT };
