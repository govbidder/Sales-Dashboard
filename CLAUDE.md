# GovBidder General Dashboard

Dashboard general/operativo interno de GovBidder. La "vista de comando" del negocio — pensada para que Santo (founder) la abra a primera hora y entienda en menos de 2 minutos cómo está todo, sin abrir 8 herramientas distintas.

## Quién lo usa

- **Santo (founder)**: vista global. Qué se vendió ayer, qué tareas están trabadas, qué KPIs de contenido están bajos, qué área del equipo está saturada.
- **Equipo interno por área**: cada departamento entra a su sección y ve sus tareas asignadas, KPIs propios, lo que tiene que hacer hoy.

## Qué incluye

- KPIs de contenido (publicaciones, performance, alcance, tendencias).
- KPIs de ventas (deals, conversiones, números del mes).
- KPIs de negocio general (revenue, métricas operativas).
- Vista por departamento (cada área tiene su sub-dashboard).
- Tareas asignadas por departamento.
- Reportes mensuales y métricas comparativas.
- AI assistant para preguntas tipo "cómo va el mes" sin armar queries.

## UX

- **Vibe**: tipo Go High Level. Sobrio, profesional, modular.
- **Secuenciado**: información en orden de importancia, no todo apilado.
- **Masticable**: cards que se leen rápido, sin sobrecarga cognitiva.
- **Organizado**: agrupado por área/temática. No mezclar KPIs de ventas con tareas operativas en la misma card.

## Lo que NO es

- No es un CRM, ni una landing pública, ni un sistema de coaching.
- No es self-service para clientes finales — es herramienta interna.
- No es un proyecto de showcase — es operación real diaria.

## Stack

- **Framework**: Next.js 16.0.10 (App Router) — React 19.2.0
- **Lenguaje**: TypeScript 6.0
- **Styling**: Tailwind CSS 4.1 + tw-animate-css
- **Componentes UI**: Radix UI primitives + shadcn/ui pattern (CVA + tailwind-merge)
- **Backend/DB**: Supabase (auth, Postgres con RLS, service role para API routes)
- **AI**: Anthropic SDK (@anthropic-ai/sdk) — usado en chat, email composer, standups
- **Email**: Resend
- **Charts**: Recharts 2.15
- **Forms**: react-hook-form + zod
- **Drag & Drop**: @dnd-kit
- **Virtualización**: @tanstack/react-virtual
- **Deploy**: Vercel
- **Fuente**: Raleway (via next/font/google)

## Comandos clave

```bash
npm run dev      # Dev server
npm run build    # Build de producción
npm run lint     # ESLint
npm run start    # Serve build local
npx tsc --noEmit # Type check (no hay script, correr manualmente)
```

## Convenciones

- **Server Components por default**. Usar `'use client'` solo cuando hay hooks, event handlers, o browser APIs.
- **Imágenes**: siempre `next/image`, nunca `<img>` raw.
- **Colores**: usar variables CSS del tema (`text-foreground`, `bg-card`, `border-border`, etc.). Nunca hardcodear colores de Tailwind como `text-red-300` — rompen light/dark mode.
- **Commits**: formato `tipo(scope): descripción`. Ejemplos reales del repo: `fix(rls): recursión infinita en policy`, `feat: bulk CSV import + audit log`, `chore: .env.example con variables`.
- **Supabase client-side**: usar `createClient()` de `lib/supabase.ts` (anon key).
- **Supabase server-side**: usar `createServiceClient()` de `lib/supabase-service.ts` (service role, bypasea RLS).
- **API Routes**: viven en `app/api/`. Las rutas admin van en `app/api/admin/`.
- **Vistas**: el patrón es `app/[seccion]/page.tsx` importa un componente de `components/views/[seccion]-view.tsx`.
- **UI components**: `components/ui/` contiene primitivos reutilizables (button, card, input, select, toast, skeleton, etc.).

## Estructura

```
app/
  layout.tsx              # Root layout (Raleway font, ThemeProvider)
  page.tsx                # Landing / home
  admin/                  # Páginas admin (personas, tasks, forms, reports, audit-log, team, etc.)
  api/
    admin/                # API routes admin (personas, tasks, ai-email, ai-standup, reports, etc.)
    ai/chat/              # AI assistant endpoint
    cron/                 # Cron jobs (email-digest, generate-recurring, monthly-report)
    forms/[slug]/         # Forms públicos
    resources/            # Recursos
  dashboard/              # Dashboard principal
  sales/                  # Vista de ventas / Cha-Ching
  calendar/               # Calendario de sesiones
  metrics/                # Métricas y KPIs
  tools/                  # Herramientas (content research, etc.)
  inicio/                 # Vista de inicio
  login/ signup/ forgot-password/ reset-password/  # Auth flows

components/
  ai/                     # AI assistant component
  layout/                 # Dashboard layout, sidebar, top-bar, command palette, notifications
  sections/               # Widgets de dashboard (KPIs, charts, projections, profitability)
  views/                  # Vistas completas importadas por las pages
  ui/                     # Primitivos UI (shadcn pattern)

lib/
  supabase.ts             # Client browser (anon key)
  supabase-service.ts     # Client server (service role key)
  utils.ts                # cn() y utilidades
  ai-diagnosis.ts         # Lógica de diagnóstico AI
  email.ts                # Envío de emails con Resend
  rate-limit.ts           # Rate limiting para API routes
  csv-parse.ts            # Parsing de CSV para bulk import
  export-csv.ts           # Export a CSV
  audit.ts                # Logging de auditoría

supabase/
  schema.sql              # Schema completo de la DB
  migrations/             # Migraciones SQL
  hotfix-profiles-recursion.sql  # Fix del bug de recursión RLS
  config.toml             # Config de Supabase
```

## Gotchas conocidos

- **RLS recursivo en `profiles`**: nunca crear una policy en `profiles` que haga sub-query a `profiles`. Causa `infinite recursion detected in policy for relation 'profiles'`. Usar la función `SECURITY DEFINER` `public.is_admin()` para checks de admin. Ver `supabase/hotfix-profiles-recursion.sql` como referencia.
- **Dos Supabase clients**: `lib/supabase.ts` (anon, client-side) vs `lib/supabase-service.ts` (service role, server-only). Nunca usar el service client en código que llegue al browser.
- **`@supabase/supabase-js` está en `"latest"`**: la versión no está pinneada. Puede romperse con updates inesperados en CI.
- **Cron routes** (`app/api/cron/`): se invocan desde Vercel Cron — no tienen auth de usuario, usan service role.
- **ThemeProvider**: dark mode está activo. Todos los colores deben funcionar en ambos modos.
- **No hay test runner configurado**: no hay jest/vitest/playwright en el repo. Validar con `npx tsc --noEmit` y `npm run lint`.

## Variables de entorno

Ver `.env.example` para la lista completa. Las requeridas:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server only)
- `ANTHROPIC_API_KEY` — Para features de AI
- `RESEND_API_KEY` — Para email digest (opcional)

## Workflow

1. Leer este archivo y entender el contexto.
2. Antes de cambios grandes, leer los archivos involucrados.
3. Type check después de cada batch: `npx tsc --noEmit`.
4. Lint: `npm run lint`.
5. Commits chicos con mensajes claros: `tipo(scope): descripción`.
6. Resumen final al cerrar feature.
