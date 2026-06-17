# Auditoría y correcciones — El Pollón Social Automation

Fecha: Junio 2026  
Estado: **Build OK** | **Listo para producción** (tras ejecutar migración 002)

---

## 1. Errores encontrados y corregidos

### Críticos (seguridad)
| Error | Corrección |
|-------|------------|
| Cualquier usuario podía cambiar su `role` a `super_admin` vía UPDATE en `profiles` | Migración `002_security_fixes.sql` — trigger anti-escalada |
| Registro podía asignar rol desde `user_metadata` | Trigger `handle_new_user` siempre asigna `creador_contenido` |
| `/api/posts/:id/retry` sin control de rol/sucursal | `roleGuard` + `assertBranchAccess` |
| `/api/posts/:id/reject` sin verificación de sucursal | Igual que approve |
| Tokens de redes visibles para `creador_contenido` | RLS: solo `admin_sucursal` y `super_admin` |
| CORS solo en `APP_URL` — previews Vercel bloqueadas | CORS dinámico para `*.vercel.app` |

### Funcionales
| Error | Corrección |
|-------|------------|
| Generación de imágenes: rutas de plantillas rotas | `getTemplatesDir()` prueba múltiples rutas |
| Plantillas `{{#key}}` no procesadas | `fillTemplate` soporta bloques condicionales |
| Error `[object Object]` en frontend | `apiFetch` parsea errores Zod correctamente |
| Título vacío al generar imagen | Validación en frontend y backend |
| Cron procesaba 50 posts (timeout Vercel) | Límite reducido a 5 por ejecución |
| `ProtectedRoute` permitía acceso sin perfil | Bloqueo si no existe fila en `profiles` |
| Credenciales hardcodeadas en scripts | `setup-admin.ts` usa argumentos/env |

### Deploy / Vercel
| Error | Corrección |
|-------|------------|
| `memory: 3008` incompatible con plan Hobby | Cambiado a `1024` |
| `playwright` completo en dependencies (bundle pesado) | Movido a `devDependencies` |
| `/api/health` exponía warnings en producción | Solo `{ status: 'ok' }` en prod |

---

## 2. Archivos modificados

```
server/index.ts                    — Seguridad API, CORS, asyncHandler
server/utils/asyncHandler.ts       — Nuevo
server/utils/branchAccess.ts       — Nuevo
server/utils/roleGuard.ts          — timingSafeEqual para CRON
server/services/image-generator/renderPostImage.ts
server/jobs/publishDuePosts.ts
server/config/index.ts
src/lib/utils.ts
src/components/ProtectedRoute.tsx
src/pages/LoginPage.tsx
src/pages/PostCreatorPage.tsx
src/pages/SocialConfigPage.tsx
scripts/setup-admin.ts
scripts/test-login.ts
supabase/migrations/002_security_fixes.sql  — NUEVO
package.json
vercel.json
.gitignore
.env.example
```

---

## 3. Roles del sistema

Este proyecto es **automatización de marketing**, no POS.

| Rol | Existe |
|-----|--------|
| `super_admin` | ✅ |
| `admin_sucursal` | ✅ |
| `creador_contenido` | ✅ |
| `aprobador` | ✅ |
| `cajera`, `cocina`, `delivery` | ❌ No aplican (delivery es tipo de post) |

---

## 4. Ejecutar localmente

```bash
cd AUTOMATIZACION
cp .env.example .env
# Completa variables en .env

npm install
npx playwright install chromium   # Solo para generar imágenes local

npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

**Crear admin:**
```bash
npm run setup:admin -- tu@email.com TuPassword123
```

---

## 5. Desplegar en Vercel

1. Push a GitHub: `git push origin main`
2. Vercel importa el repo
3. Framework: **Vite** | Output: `dist/client` | Build: `npm run build`
4. Variables de entorno (ver sección 7)
5. `APP_URL` = `https://automatizacion-seven.vercel.app` (tu URL real)
6. Redeploy sin caché tras agregar `VITE_*`

**Supabase:** Ejecutar en SQL Editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/policies/rls_policies.sql`
3. `supabase/migrations/002_security_fixes.sql` ← **NUEVO, obligatorio**
4. `supabase/seed/seed.sql`

**GitHub Actions secrets:**
- `APP_URL` = tu URL Vercel
- `CRON_SECRET` = mismo que en Vercel

---

## 6. Variables de entorno necesarias

### Obligatorias
| Variable | Dónde |
|----------|-------|
| `VITE_SUPABASE_URL` | Vercel + .env |
| `VITE_SUPABASE_ANON_KEY` | Vercel + .env |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel + .env (solo servidor) |
| `SUPABASE_STORAGE_BUCKET` | `social-posts` |
| `CRON_SECRET` | Vercel + GitHub |
| `APP_URL` | Vercel + GitHub |
| `NODE_ENV` | `production` |

### Meta (publicar en Facebook/Instagram)
| `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION` |

### Opcionales
| `OPENAI_API_KEY` | IA automática |
| `TIKTOK_*`, `GOOGLE_*` | Integraciones preparadas |

---

## 7. Pruebas finales

| Prueba | Cómo |
|--------|------|
| Login | `/login` con credenciales Supabase |
| Dashboard carga | `/` sin errores en consola |
| Crear publicación + IA | Texto generado (plantilla o OpenAI) |
| Generar imagen | Título + Playwright local / Vercel |
| Aprobar publicación | Rol aprobador |
| Redes sociales | Probar conexión Facebook |
| Health API | `GET /api/health` → `{ status: 'ok' }` |
| Cron manual | GitHub Actions → Run workflow |
| Build | `npm run build` sin errores |

---

## 8. Seguridad GitHub

- `.env` está en `.gitignore` ✅
- No commitear `SUPABASE_SERVICE_ROLE_KEY`, tokens Meta, etc.
- Si alguna clave se expuso: rotar en Supabase/Meta/OpenAI
- Scripts ya no incluyen emails/contraseñas fijas

---

## 9. Limitaciones conocidas

1. **Generación de imágenes en Vercel**: usa `@sparticuz/chromium`; primera ejecución puede ser lenta (cold start).
2. **Tokens Meta**: expiran ~60 días; renovar manualmente.
3. **TikTok/Google**: módulos preparados; requieren aprobación de APIs externas.
4. **Plan Vercel Hobby**: memoria 1024MB; cron limitado a 5 posts por ejecución.

---

*Sistema auditado para producción multisucursal — Pollería El Pollón*
