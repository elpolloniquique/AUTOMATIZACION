import sharp from 'sharp';

const iconCache = new Map<string, Buffer>();

async function rasterizeIcon(svg: string, size: number): Promise<Buffer> {
  const key = `${size}:${svg.slice(0, 40)}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const buf = await sharp(Buffer.from(svg, 'utf8'), { density: 192 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  iconCache.set(key, buf);
  return buf;
}

/** Icono WhatsApp realista con gradiente verde */
export async function getWhatsappIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="wa" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#5FE06A"/>
        <stop offset="0.5" stop-color="#25D366"/>
        <stop offset="1" stop-color="#128C7E"/>
      </linearGradient>
      <filter id="sh" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.22"/>
      </filter>
    </defs>
    <circle cx="48" cy="48" r="42" fill="url(#wa)" filter="url(#sh)"/>
    <path fill="#fff" d="M48 18c-16.5 0-30 13.1-30 29.2 0 5.1 1.4 10.1 4.1 14.5L18 78l16.8-4.4c4.2 2.3 8.9 3.5 13.7 3.5 16.5 0 30-13.1 30-29.2S64.5 18 48 18zm0 53.4c-4.4 0-8.7-1.2-12.4-3.4l-.9-.5-9.9 2.6 2.6-9.6-.6-.9c-2.4-3.8-3.7-8.2-3.7-12.7 0-13.4 11-24.3 24.9-24.3S72.4 34.9 72.4 48.3 61.4 71.4 48 71.4z"/>
    <path fill="#fff" d="M66.2 55.8c-.9-.4-5.2-2.6-6-2.9-.8-.3-1.4-.5-2 .5-.6 1-2.2 2.9-2.7 3.5-.5.6-.9.7-1.8.2-.9-.4-3.7-1.4-7-4.3-2.6-2.3-4.3-5.1-4.8-6-.5-.9 0-1.4.6-1.8.5-.5 1.2-1.3 1.8-1.9.6-.6.8-1.1 1-1.8.2-.7 0-1.4-.2-2-.2-.6-1.9-4.7-2.6-6.4-.7-1.6-1.4-1.3-1.9-1.3h-1.7c-.6 0-1.4.3-2.2 1-.8.8-3 2.6-3 6.4s2.9 7.5 3.4 8 .6 1.3 5.8 8.5c7.1 4.5 12.4 5.8 14.2 6.4 1.9.7 3.5.6 4.8.4 1.5-.2 4.9-2 5.7-4 .8-2 .8-3.7.6-4-.2-.4-.9-.6-1.8-1z"/>
  </svg>`;
  return rasterizeIcon(svg, size);
}

/** Icono web/globo realista con gradiente azul */
export async function getGlobeIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="globe" cx="35%" cy="30%" r="65%">
        <stop offset="0" stop-color="#7EB8FF"/>
        <stop offset="0.45" stop-color="#3B82F6"/>
        <stop offset="1" stop-color="#1D4ED8"/>
      </radialGradient>
      <filter id="gs" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
      </filter>
    </defs>
    <circle cx="48" cy="48" r="40" fill="url(#globe)" filter="url(#gs)"/>
    <ellipse cx="48" cy="48" rx="40" ry="14" fill="none" stroke="#fff" stroke-width="2.2" opacity="0.85"/>
    <ellipse cx="48" cy="48" rx="14" ry="40" fill="none" stroke="#fff" stroke-width="2.2" opacity="0.85"/>
    <path d="M8 48h80M48 8v80" stroke="#fff" stroke-width="1.8" opacity="0.55"/>
    <path fill="#fff" opacity="0.9" d="M30 36c4-6 10-10 18-10 3 0 6 1 8 2-3 2-5 5-6 8-4-1-8 0-12 0zm22 28c-6 4-14 5-20 2 2-3 5-5 9-6 3 3 7 5 11 4z"/>
    <ellipse cx="36" cy="34" rx="10" ry="6" fill="#fff" opacity="0.25"/>
  </svg>`;
  return rasterizeIcon(svg, size);
}

/** Icono moto delivery realista */
export async function getDeliveryIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 72">
    <defs>
      <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#E53935"/>
        <stop offset="1" stop-color="#B71C1C"/>
      </linearGradient>
    </defs>
    <g transform="translate(4,8)">
      <circle cx="18" cy="48" r="11" fill="#263238" stroke="#90A4AE" stroke-width="2.5"/>
      <circle cx="18" cy="48" r="5" fill="#CFD8DC"/>
      <circle cx="66" cy="48" r="11" fill="#263238" stroke="#90A4AE" stroke-width="2.5"/>
      <circle cx="66" cy="48" r="5" fill="#CFD8DC"/>
      <path fill="url(#body)" d="M22 38h18l8-14h12l6 14h8l-4-18H52L42 8H28l-4 14H14l4 16z"/>
      <rect x="38" y="10" width="14" height="10" rx="2" fill="#FFCDD2"/>
      <path fill="#455A64" d="M48 22h14l4 10H46z"/>
      <circle cx="74" cy="18" r="7" fill="#FFEB3B" stroke="#F9A825" stroke-width="1.5"/>
      <path fill="#fff" d="M72 16h4v4h-4z"/>
      <path fill="#37474F" d="M8 32h10v8H8z"/>
    </g>
  </svg>`;
  const key = `delivery:${size}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const buf = await sharp(Buffer.from(svg, 'utf8'), { density: 192 })
    .resize(Math.round(size * 1.35), size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  iconCache.set(key, buf);
  return buf;
}
