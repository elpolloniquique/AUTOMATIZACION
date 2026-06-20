export const POLLON_BRAND = {
  whatsappUrl: 'https://wa.me/56986925310',
  whatsappPhone: '+56 9 8692 5310',
  websiteUrl: 'https://www.el-pollon.cl/',
  websiteDisplay: 'www.el-pollon.cl',
  addressDisplay: 'Vivar 1086, Iquique',
  deliveryCities: 'Iquique, Alto Hospicio y Arica',
  hours: '11:30 a 23:00 hrs',
  tagline: 'Pollo a la Brasa · Delivery a Domicilio',
} as const;

export const POLLON_CONTACT_BLOCK = `📱 Haz tu pedido por WhatsApp
👉 ${POLLON_BRAND.whatsappUrl}

🍗 Pollo a la Brasa
🚚 Delivery a Domicilio
📍 ${POLLON_BRAND.deliveryCities}
⏰ Atención de ${POLLON_BRAND.hours}

🌐 Haz tu pedido aquí:
${POLLON_BRAND.websiteUrl}`;

export function appendPollonContact(text: string): string {
  const normalized = text.trim();
  if (normalized.includes('el-pollon.cl') || normalized.includes('wa.me/56986925310')) {
    return normalized;
  }
  return `${normalized}\n\n${POLLON_CONTACT_BLOCK}`;
}

export function pollonImageTemplateVars(): Record<string, string> {
  return {
    whatsappUrl: POLLON_BRAND.whatsappUrl,
    whatsappPhone: POLLON_BRAND.whatsappPhone,
    websiteUrl: POLLON_BRAND.websiteUrl,
    websiteDisplay: POLLON_BRAND.websiteDisplay,
    deliveryCities: POLLON_BRAND.deliveryCities,
    hours: POLLON_BRAND.hours,
    tagline: POLLON_BRAND.tagline,
  };
}
