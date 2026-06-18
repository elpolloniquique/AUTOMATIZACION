import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  cronSecret: process.env.CRON_SECRET || '',
  supabase: {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'social-posts',
    galleryBucket: process.env.SUPABASE_GALLERY_BUCKET || 'media-gallery',
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    graphVersion: process.env.META_GRAPH_VERSION || 'v20.0',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },
  tiktok: {
    clientKey: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
} as const;

export function validateConfig(): string[] {
  const warnings: string[] = [];
  if (!config.supabase.url) warnings.push('VITE_SUPABASE_URL no configurado');
  if (!config.supabase.serviceRoleKey) warnings.push('SUPABASE_SERVICE_ROLE_KEY no configurado');
  if (!config.cronSecret) warnings.push('CRON_SECRET no configurado (requerido en producción)');
  if (config.nodeEnv === 'production' && !process.env.APP_URL) {
    warnings.push('APP_URL no configurado (CORS puede fallar)');
  }
  return warnings;
}
