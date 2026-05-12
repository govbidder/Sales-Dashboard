/**
 * Layout aislado del CRM — NO usa el DashboardLayout principal.
 *
 * Esto le da identidad propia y refuerza la sensación de "otro universo"
 * dentro de la misma app. El root layout (app/layout.tsx) sigue
 * aplicando (font Raleway, theme provider, etc.) pero todo el chrome
 * del dashboard (sidebar, topbar, banners) queda afuera.
 */

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
