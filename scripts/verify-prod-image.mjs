/**
 * Verifica generación de imagen en producción.
 * Uso: node scripts/verify-prod-image.mjs
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const PROD_URL = 'https://automatizacion-seven.vercel.app';
const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(msg) {
  console.error('❌', msg);
  process.exit(1);
}

function ok(msg) {
  console.log('✅', msg);
}

async function getSessionToken() {
  if (!supabaseUrl || !anonKey || !serviceKey) {
    fail('Faltan VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en .env');
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profiles, error: profErr } = await admin
    .from('profiles')
    .select('id, email, role')
    .eq('role', 'super_admin')
    .limit(1);

  if (profErr || !profiles?.length) fail('No se encontró super_admin en profiles');

  const email = profiles[0].email;
  if (!email) fail('El super_admin no tiene email en profiles');

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    fail(`No se pudo generar sesión de prueba: ${linkErr?.message || 'sin token'}`);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: otpData, error: otpErr } = await userClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  });

  if (otpErr || !otpData.session?.access_token) {
    fail(`Login de prueba falló: ${otpErr?.message || 'sin access_token'}`);
  }

  return { token: otpData.session.access_token, email, admin };
}

async function main() {
  // 1. Health
  const healthRes = await fetch(`${PROD_URL}/api/health`);
  const health = await healthRes.json();
  if (!healthRes.ok || health.status !== 'ok') fail(`Health check falló: ${healthRes.status}`);
  ok(`Health: ${PROD_URL}/api/health → ${health.status}`);

  // 2. Login (sesión temporal vía service role, sin tocar contraseña)
  const { token, email, admin } = await getSessionToken();
  ok(`Sesión de prueba OK (${email})`);

  // 3. Branch + gallery
  const { data: branches } = await admin.from('branches').select('id,name,brand_color,logo_url').eq('is_active', true).limit(1);
  const branch = branches?.[0];
  if (!branch) fail('No hay sucursales activas en Supabase');

  const { data: gallery } = await admin
    .from('media_gallery')
    .select('id,title,public_url')
    .eq('is_active', true)
    .or(`branch_id.eq.${branch.id},branch_id.is.null`)
    .limit(1);

  const photo = gallery?.[0];
  if (!photo) fail('No hay fotos en la galería para probar');

  ok(`Sucursal: ${branch.name} | Foto: ${photo.title}`);

  // 4. Frame templates (prueba API + migración 007)
  const tplRes = await fetch(`${PROD_URL}/api/frame-templates?branch_id=${branch.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tplBody = await tplRes.json();
  if (!tplRes.ok) {
    if (tplBody.error?.includes('brand_frame_templates')) {
      fail('Tabla brand_frame_templates no existe — ejecuta migración 007 en Supabase');
    }
    fail(`frame-templates: ${tplBody.error || tplRes.status}`);
  }
  ok(`Plantillas footer: ${(tplBody.templates || []).length}`);

  // 5. Generate image (gallery_pick — prueba fuente DejaVu + footer)
  const payload = {
    mode: 'gallery_pick',
    template_slug: 'oferta-familiar',
    branch_id: branch.id,
    branch_name: branch.name,
    offer_title: `Test producción ${new Date().toISOString().slice(11, 19)}`,
    price: '$9.990',
    logo_url: branch.logo_url || undefined,
    brand_color: branch.brand_color || '#c50000',
    gallery_item_ids: [photo.id],
  };

  console.log('⏳ Generando imagen en producción (puede tardar ~15-40s)...');
  const t0 = Date.now();
  const genRes = await fetch(`${PROD_URL}/api/images/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const genBody = await genRes.json();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  if (!genRes.ok) {
    console.error('Respuesta:', JSON.stringify(genBody, null, 2));
    const err = genBody.error || 'error desconocido';
    if (String(err).includes('DejaVu') || String(err).includes('fuente')) {
      fail(`Error de fuente aún presente: ${err}`);
    }
    fail(`Generación falló (${genRes.status}): ${err}`);
  }

  if (!genBody.url) fail('La API respondió OK pero sin URL de imagen');

  ok(`Imagen generada en ${elapsed}s`);
  console.log('   URL:', genBody.url);
  console.log('   Modo:', genBody.mode, '| Fuente:', genBody.aiSource);

  // 6. Verificar que la imagen es accesible y tiene tamaño razonable
  const imgRes = await fetch(genBody.url, { method: 'HEAD' });
  if (!imgRes.ok) fail(`Imagen no accesible: HTTP ${imgRes.status}`);
  const size = Number(imgRes.headers.get('content-length') || 0);
  const type = imgRes.headers.get('content-type');
  if (size > 0 && size < 5000) fail(`Imagen sospechosamente pequeña (${size} bytes) — posible error`);
  ok(`Imagen accesible (${type}, ${size ? `${Math.round(size / 1024)} KB` : 'tamaño OK'})`);

  // 7. Segunda prueba con plantilla de footer si existe
  const tpl = tplBody.templates?.[0];
  if (tpl) {
    console.log(`⏳ Probando con plantilla footer "${tpl.name}"...`);
    const t1 = Date.now();
    const gen2 = await fetch(`${PROD_URL}/api/images/generate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, frame_template_id: tpl.id }),
    });
    const body2 = await gen2.json();
    const e2 = ((Date.now() - t1) / 1000).toFixed(1);
    if (!gen2.ok || !body2.url) {
      fail(`Generación con plantilla falló: ${body2.error || gen2.status}`);
    }
    ok(`Imagen con plantilla "${tpl.name}" en ${e2}s → ${body2.url}`);
  }

  console.log('⏳ Probando Sin footer (solo foto)...');
  const t3 = Date.now();
  const gen3 = await fetch(`${PROD_URL}/api/images/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...payload, use_frame: false }),
  });
  const body3 = await gen3.json();
  const e3 = ((Date.now() - t3) / 1000).toFixed(1);
  if (!gen3.ok || !body3.url) fail(`Sin footer falló: ${body3.error || gen3.status}`);
  ok(`Imagen sin footer en ${e3}s → ${body3.url}`);

  console.log('\n🎉 Verificación de producción completada correctamente.');
}

main().catch((e) => fail(e.message || String(e)));
