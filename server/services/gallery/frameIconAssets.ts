import sharp from 'sharp';

const iconCache = new Map<string, Buffer>();

async function rasterizeIcon(iconId: string, svg: string, size: number, width?: number): Promise<Buffer> {
  const w = width ?? size;
  const key = `${iconId}:${w}x${size}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const buf = await sharp(Buffer.from(svg, 'utf8'), { density: 192 })
    .resize(w, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  iconCache.set(key, buf);
  return buf;
}

/** Icono WhatsApp realista con gradiente verde */
export async function getWhatsappIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="waGrad" x1="8" y1="8" x2="88" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#5FE06A"/>
        <stop offset="0.5" stop-color="#25D366"/>
        <stop offset="1" stop-color="#128C7E"/>
      </linearGradient>
      <filter id="waSh" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.22"/>
      </filter>
    </defs>
    <circle cx="48" cy="48" r="42" fill="url(#waGrad)" filter="url(#waSh)"/>
    <path fill="#fff" d="M48 18c-16.5 0-30 13.1-30 29.2 0 5.1 1.4 10.1 4.1 14.5L18 78l16.8-4.4c4.2 2.3 8.9 3.5 13.7 3.5 16.5 0 30-13.1 30-29.2S64.5 18 48 18zm0 53.4c-4.4 0-8.7-1.2-12.4-3.4l-.9-.5-9.9 2.6 2.6-9.6-.6-.9c-2.4-3.8-3.7-8.2-3.7-12.7 0-13.4 11-24.3 24.9-24.3S72.4 34.9 72.4 48.3 61.4 71.4 48 71.4z"/>
    <path fill="#fff" d="M66.2 55.8c-.9-.4-5.2-2.6-6-2.9-.8-.3-1.4-.5-2 .5-.6 1-2.2 2.9-2.7 3.5-.5.6-.9.7-1.8.2-.9-.4-3.7-1.4-7-4.3-2.6-2.3-4.3-5.1-4.8-6-.5-.9 0-1.4.6-1.8.5-.5 1.2-1.3 1.8-1.9.6-.6.8-1.1 1-1.8.2-.7 0-1.4-.2-2-.2-.6-1.9-4.7-2.6-6.4-.7-1.6-1.4-1.3-1.9-1.3h-1.7c-.6 0-1.4.3-2.2 1-.8.8-3 2.6-3 6.4s2.9 7.5 3.4 8 .6 1.3 5.8 8.5c7.1 4.5 12.4 5.8 14.2 6.4 1.9.7 3.5.6 4.8.4 1.5-.2 4.9-2 5.7-4 .8-2 .8-3.7.6-4-.2-.4-.9-.6-1.8-1z"/>
  </svg>`;
  return rasterizeIcon('whatsapp', svg, size);
}

/** Icono internet / pagina web — globo azul claramente distinto de WhatsApp */
export async function getGlobeIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="webGlobe" cx="38%" cy="32%" r="68%">
        <stop offset="0" stop-color="#93C5FD"/>
        <stop offset="0.5" stop-color="#2563EB"/>
        <stop offset="1" stop-color="#1E3A8A"/>
      </radialGradient>
      <filter id="webSh" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.2"/>
      </filter>
    </defs>
    <circle cx="48" cy="48" r="40" fill="url(#webGlobe)" filter="url(#webSh)"/>
    <ellipse cx="48" cy="48" rx="40" ry="15" fill="none" stroke="#fff" stroke-width="2.5"/>
    <ellipse cx="48" cy="48" rx="15" ry="40" fill="none" stroke="#fff" stroke-width="2.5"/>
    <path d="M8 48h80" stroke="#fff" stroke-width="2" opacity="0.7"/>
    <path d="M48 8v80" stroke="#fff" stroke-width="2" opacity="0.7"/>
    <path fill="#fff" opacity="0.95" d="M28 38c3-5 9-9 16-9 2 0 4 0 6 1-2 2-4 4-5 7-5-1-10 0-17 1zm20 26c-5 3-12 4-18 1 2-2 4-4 8-5 2 2 6 4 10 4z"/>
    <path fill="#fff" opacity="0.9" d="M34 58h28v3H34zm0 5h22v3H34zm0 5h16v3H34z"/>
  </svg>`;
  return rasterizeIcon('globe', svg, size);
}

/** Icono delivery — moto roja con rayo de velocidad */
export async function getDeliveryIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="motoRed" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FF5252"/>
        <stop offset="1" stop-color="#C50000"/>
      </linearGradient>
    </defs>
    <path fill="#FFC107" d="M8 28 L22 28 L18 38 L8 38 Z"/>
    <path fill="#FFD54F" d="M22 22 L32 28 L28 36 L18 32 Z"/>
    <circle cx="24" cy="68" r="12" fill="#37474F"/>
    <circle cx="24" cy="68" r="5" fill="#ECEFF1"/>
    <circle cx="68" cy="68" r="12" fill="#37474F"/>
    <circle cx="68" cy="68" r="5" fill="#ECEFF1"/>
    <path fill="url(#motoRed)" d="M28 52h16l10-18h14l8 18h10l-6-24H58L46 20H32l-6 18H20l4 14z"/>
    <rect x="42" y="22" width="16" height="12" rx="2" fill="#FFCDD2" stroke="#C50000" stroke-width="1"/>
    <path fill="#455A64" d="M54 38h16l5 14H52z"/>
    <circle cx="78" cy="32" r="8" fill="#FFEB3B" stroke="#F9A825" stroke-width="1.5"/>
    <path fill="#C50000" d="M36 44h4v12h-4z M40 40h8l-2 16h-8z"/>
  </svg>`;
  return rasterizeIcon('delivery', svg, size);
}

/** Rayo rojo de velocidad (alternativa compacta para boton CTA) */
export async function getSpeedBoltIcon(size: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="boltGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FF6B6B"/>
        <stop offset="1" stop-color="#C50000"/>
      </linearGradient>
    </defs>
    <path fill="url(#boltGrad)" d="M52 8 L28 52 H44 L36 88 L68 40 H50 L52 8 Z"/>
  </svg>`;
  return rasterizeIcon('bolt', svg, size);
}

/** Globo blanco sobre circulo rojo realista — estilo HF02 */
export async function getGlobeOnRedCircle(size: number, red = '#C40000'): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="hf02Globe" cx="35%" cy="30%" r="70%">
        <stop offset="0" stop-color="#FF6B6B"/>
        <stop offset="0.55" stop-color="${red}"/>
        <stop offset="1" stop-color="#8B0000"/>
      </radialGradient>
      <filter id="hf02GlobeSh" x="-12%" y="-12%" width="124%" height="124%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.28"/>
      </filter>
    </defs>
    <circle cx="48" cy="48" r="42" fill="url(#hf02Globe)" filter="url(#hf02GlobeSh)"/>
    <ellipse cx="48" cy="48" rx="28" ry="11" fill="none" stroke="#fff" stroke-width="2.4"/>
    <ellipse cx="48" cy="48" rx="11" ry="28" fill="none" stroke="#fff" stroke-width="2.4"/>
    <path d="M18 48h60M48 18v60" stroke="#fff" stroke-width="1.6" opacity="0.75"/>
    <path fill="#fff" opacity="0.95" d="M32 38c2-4 8-7 14-7 3 0 5 1 6 2-2 1-4 3-5 5-4-1-8 0-15 0zm18 24c-5 2-11 3-16 0 2-2 4-4 7-5 2 2 5 4 9 5z"/>
  </svg>`;
  return rasterizeIcon(`globe-red-v2-${red}`, svg, size);
}

/** Telefono blanco sobre circulo rojo realista — estilo HF02 */
export async function getPhoneOnRedCircle(size: number, red = '#C40000'): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <radialGradient id="hf02Phone" cx="35%" cy="28%" r="72%">
        <stop offset="0" stop-color="#FF6B6B"/>
        <stop offset="0.55" stop-color="${red}"/>
        <stop offset="1" stop-color="#8B0000"/>
      </radialGradient>
      <filter id="hf02PhoneSh" x="-12%" y="-12%" width="124%" height="124%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.28"/>
      </filter>
    </defs>
    <circle cx="48" cy="48" r="42" fill="url(#hf02Phone)" filter="url(#hf02PhoneSh)"/>
    <path fill="#fff" d="M62 24H34c-2.8 0-5 2.2-5 5v38c0 2.8 2.2 5 5 5h28c2.8 0 5-2.2 5-5V29c0-2.8-2.2-5-5-5zm-14 54c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm14-34H34V34h28v10z"/>
  </svg>`;
  return rasterizeIcon(`phone-red-v2-${red}`, svg, size);
}

/** Pin de ubicacion rojo realista — estilo HF02 */
export async function getLocationPinIcon(size: number, red = '#C40000'): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="hf02Pin" x1="48" y1="8" x2="48" y2="88" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FF5252"/>
        <stop offset="0.45" stop-color="${red}"/>
        <stop offset="1" stop-color="#7A0000"/>
      </linearGradient>
      <filter id="hf02PinSh" x="-15%" y="-10%" width="130%" height="130%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000" flood-opacity="0.3"/>
      </filter>
    </defs>
    <path filter="url(#hf02PinSh)" fill="url(#hf02Pin)" d="M48 10c-14.4 0-26 11.2-26 25 0 17.5 26 51 26 51s26-33.5 26-51C74 21.2 62.4 10 48 10zm0 34c-5.5 0-10-4.5-10-10s4.5-10 10-10 10 4.5 10 10-4.5 10-10 10z"/>
    <circle cx="48" cy="34" r="7" fill="#fff" opacity="0.95"/>
  </svg>`;
  return rasterizeIcon(`pin-v2-${red}`, svg, size);
}

/** Rayo amarillo vertical decorativo — header HF02 */
export async function getYellowLightningBolt(width: number, height: number, yellow = '#F2B705'): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 96">
    <defs>
      <linearGradient id="hf02Bolt" x1="24" y1="0" x2="24" y2="96" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#FFE082"/>
        <stop offset="0.5" stop-color="${yellow}"/>
        <stop offset="1" stop-color="#E6A800"/>
      </linearGradient>
      <filter id="hf02BoltSh" x="-20%" y="-5%" width="140%" height="110%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity="0.2"/>
      </filter>
    </defs>
    <path filter="url(#hf02BoltSh)" fill="url(#hf02Bolt)" d="M26 4 L14 46 H22 L18 92 L34 38 H26 L30 4 Z"/>
  </svg>`;
  return rasterizeIcon(`bolt-yellow-${yellow}`, svg, height, width);
}
