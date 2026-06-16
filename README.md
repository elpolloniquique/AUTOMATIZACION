# El Pollón Social Automation

Plataforma multisucursal para automatizar publicaciones de marketing en **Facebook Page**, **Instagram Business**, **TikTok** y **Google Business Profile**.

> El sitio web estático original de la pollería se conservó en la carpeta `website/`.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React + Vite + TypeScript + Tailwind CSS |
| Backend | Node.js + Express (API Routes en Vercel) |
| Base de datos | Supabase PostgreSQL + Auth + Storage |
| Imágenes | Playwright + plantillas HTML |
| IA | OpenAI (opcional) + plantillas locales |
| Cron | GitHub Actions (gratis) |
| Hosting | Vercel Hobby (gratis) |

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales de Supabase

# 3. Ejecutar en desarrollo (frontend + backend)
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

```bash
# Build de producción
npm run build
```

---

## Guía paso a paso (principiantes)

### 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Clic en **New Project**.
3. Elige nombre: `el-pollon-social`.
4. Genera una contraseña segura para la base de datos.
5. Selecciona región cercana (ej: South America).
6. Espera ~2 minutos a que el proyecto esté listo.

### 2. Copiar SUPABASE_URL y ANON_KEY

1. En el dashboard de Supabase, ve a **Project Settings → API**.
2. Copia **Project URL** → pégalo en `.env` como `VITE_SUPABASE_URL`.
3. Copia **anon public** key → pégalo como `VITE_SUPABASE_ANON_KEY`.

### 3. Configurar SERVICE_ROLE_KEY

1. En la misma página API, copia **service_role** key.
2. Pégala en `.env` como `SUPABASE_SERVICE_ROLE_KEY`.
3. **NUNCA** expongas esta clave en el frontend ni en GitHub.

### 4. Ejecutar migraciones SQL

1. Ve a **SQL Editor** en Supabase.
2. Abre `supabase/migrations/001_initial_schema.sql` y ejecuta todo el contenido.
3. Abre `supabase/policies/rls_policies.sql` y ejecuta todo el contenido.
4. Abre `supabase/seed/seed.sql` y ejecuta para cargar sucursales y plantillas.

### 5. Crear bucket en Supabase Storage

1. Ve a **Storage** en Supabase.
2. Clic en **New bucket**.
3. Nombre: `social-posts`
4. Marca **Public bucket**.
5. En SQL Editor ejecuta:

```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('social-posts', 'social-posts', true)
ON CONFLICT DO NOTHING;
```

### 6. Activar RLS

Las políticas RLS ya se activan al ejecutar `rls_policies.sql`. Verifica en **Authentication → Policies** que las tablas tengan políticas activas.

### 7. Crear usuario super_admin

1. Ve a **Authentication → Users → Add user**.
2. Crea un usuario con email y contraseña (ej: `admin@elpollon.cl`).
3. Copia el **UUID** del usuario creado.
4. En SQL Editor ejecuta:

```sql
UPDATE profiles 
SET role = 'super_admin', branch_id = NULL 
WHERE email = 'admin@elpollon.cl';
```

### 8. Crear app en Meta Developers

1. Ve a [developers.facebook.com](https://developers.facebook.com).
2. **My Apps → Create App** → tipo **Business**.
3. Agrega producto **Facebook Login** y **Instagram Graph API**.
4. Copia **App ID** → `META_APP_ID` en `.env`.
5. Copia **App Secret** → `META_APP_SECRET` en `.env`.

### 9. Conectar Facebook Page

1. En Meta Developers, ve a **Tools → Graph API Explorer**.
2. Selecciona tu app y genera un token con permisos:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
3. Obtén el **Page ID** de tu página de Facebook.

### 10. Conectar Instagram Business

1. La cuenta de Instagram debe ser **Business** o **Creator**.
2. Debe estar vinculada a una Facebook Page.
3. En Graph API Explorer, consulta:
   ```
   GET /{page-id}?fields=instagram_business_account
   ```
4. Copia el **Instagram Business Account ID**.

### 11. Obtener Page Access Token

1. En Graph API Explorer, genera token de página (no de usuario).
2. Usa el endpoint:
   ```
   GET /{page-id}?fields=access_token
   ```
3. Para token de larga duración:
   ```
   GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-token}
   ```

### 12. Probar publicación en Facebook

1. Inicia sesión en el panel (`npm run dev`).
2. Ve a **Redes sociales** → selecciona sucursal.
3. Ingresa Page ID y Access Token de Facebook.
4. Clic en **Probar conexión**.
5. Crea una publicación de prueba y usa **Publicar prueba** desde la API.

### 13. Probar publicación en Instagram

1. En **Redes sociales**, configura el Instagram Business Account ID.
2. Usa el mismo Page Access Token (debe tener permisos `instagram_basic`, `instagram_content_publish`).
3. Clic en **Probar conexión**.
4. Crea publicación con imagen generada y programa.

### 14. Preparar TikTok Developers

1. Ve a [developers.tiktok.com](https://developers.tiktok.com).
2. Crea una app y solicita acceso a **Content Posting API**.
3. Copia Client Key y Secret → `.env`.
4. El módulo está preparado; hasta que aprueben la API, las publicaciones se marcan como **acción manual**.

### 15. Preparar Google Cloud / Business Profile

1. Ve a [console.cloud.google.com](https://console.cloud.google.com).
2. Crea proyecto y habilita **Google Business Profile API**.
3. Crea credenciales OAuth 2.0.
4. Copia Client ID y Secret → `.env`.
5. El módulo publica novedades cuando tengas `location_id` y token.

### 16. Subir proyecto a GitHub

```bash
git init
git add .
git commit -m "El Pollón Social Automation - sistema inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/el-pollon-social.git
git push -u origin main
```

### 17. Conectar GitHub con Vercel

1. Ve a [vercel.com](https://vercel.com) e inicia sesión con GitHub.
2. **Add New Project** → importa tu repositorio.
3. Framework: **Vite**.
4. Build Command: `npm run build`
5. Output Directory: `dist/client`

### 18. Configurar variables de entorno en Vercel

En **Project Settings → Environment Variables**, agrega todas las variables de `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `META_APP_ID`, `META_APP_SECRET`
- `OPENAI_API_KEY` (opcional)
- `APP_URL` (tu dominio Vercel)

### 19. Configurar GitHub Actions Secrets

En GitHub → **Settings → Secrets and variables → Actions**:

| Secret | Valor |
|--------|-------|
| `APP_URL` | `https://tu-dominio.vercel.app` |
| `CRON_SECRET` | Mismo valor que en Vercel |

### 20. Probar el cron manualmente

```bash
curl -X POST https://tu-dominio.vercel.app/api/cron/publish-due-posts \
  -H "Authorization: Bearer TU_CRON_SECRET"
```

O en GitHub Actions → **Publish Scheduled Posts → Run workflow**.

### 21. Programar la primera publicación

1. Inicia sesión en el panel.
2. Ve a **Crear publicación**.
3. Selecciona sucursal, red social, tipo.
4. Genera texto con IA y/o imagen con plantilla.
5. Establece fecha y hora.
6. Envía a **Aprobación**.
7. Un aprobador la aprueba → queda **programada**.
8. El cron la publica automáticamente.

### 22. Revisar logs si falla

1. Ve a **Historial** en el panel.
2. Revisa el mensaje de error.
3. Verifica tokens en **Redes sociales**.
4. En Supabase, consulta `post_logs` para detalles técnicos.

### 23. Crear nuevas plantillas

1. Crea un archivo HTML en `templates/social-posts/html/`.
2. Usa variables: `{{branchName}}`, `{{offerTitle}}`, `{{price}}`, `{{cta}}`, `{{brandColor}}`, `{{logoUrl}}`.
3. Inserta registro en `post_templates` vía SQL o Supabase Table Editor.

### 24. Agregar nuevas sucursales

1. Ve a **Sucursales** (como super_admin).
2. Clic en **Nueva sucursal**.
3. Completa datos y guarda.
4. Configura redes sociales para la nueva sucursal.

### 25. Agregar usuarios administradores por sucursal

1. Crea usuario en Supabase Auth.
2. Ve a **Usuarios** en el panel (super_admin).
3. Asigna rol `admin_sucursal` y la sucursal correspondiente.

---

## Estructura del proyecto

```
AUTOMATIZACION/
├── src/                    # Frontend React
│   ├── components/         # UI y componentes
│   ├── pages/              # Páginas del panel
│   ├── layouts/            # Layout con sidebar
│   ├── hooks/              # useAuth, etc.
│   ├── lib/                # Supabase client, utils
│   └── types/              # TypeScript types
├── server/                 # Backend Express
│   ├── api/                # (rutas en index.ts)
│   ├── jobs/               # Cron publishDuePosts
│   ├── services/           # Meta, TikTok, Google, AI, imágenes
│   └── utils/              # Auth, RLS helpers
├── api/                    # Vercel serverless entry
├── supabase/               # Migraciones, RLS, seed
├── templates/              # Plantillas HTML para imágenes
├── .github/workflows/      # GitHub Actions cron
└── website/                # Sitio web estático original
```

## Roles del sistema

| Rol | Permisos |
|-----|----------|
| `super_admin` | Acceso total, todas las sucursales |
| `admin_sucursal` | Gestiona su sucursal, aprueba, configura redes |
| `creador_contenido` | Crea borradores y envía a aprobación |
| `aprobador` | Aprueba/rechaza publicaciones de su sucursal |

## Flujo de publicación

```
Borrador → Pendiente aprobación → Aprobada → Programada → Publicada
                                    ↓
                              Rechazada → Borrador
                                    ↓
                              Fallida → Reintentar
```

## Modo IA

- **Sin OPENAI_API_KEY**: usa plantillas locales inteligentes (no rompe el sistema).
- **Con OPENAI_API_KEY**: genera textos automáticamente con GPT-4o-mini.
- **Modo manual**: pega texto de ChatGPT en el campo de caption.

## Generador de imágenes

Requiere Playwright instalado:

```bash
npx playwright install chromium
```

Genera PNG 1080×1080 desde plantillas HTML con colores de marca El Pollón.

## Costos

Todo diseñado para plan gratuito:
- Vercel Hobby
- Supabase Free (500MB DB, 1GB storage)
- GitHub Actions Free (2000 min/mes)
- Meta Developers Free
- Sin Zapier/Make de pago

## Soporte

Para problemas con APIs externas:
- **TikTok**: pendiente de aprobación → estado "acción manual"
- **Google Business**: requiere verificación de negocio en Google
- **Instagram**: requiere cuenta Business vinculada a Facebook Page

---

Desarrollado para **Pollería El Pollón** — Iquique, Alto Hospicio y Arica.
