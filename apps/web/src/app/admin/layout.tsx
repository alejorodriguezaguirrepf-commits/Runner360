import Link from "next/link";
import { IconBell, Logo } from "@/components/ui/icons";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";
import { ViewAsBanner } from "@/components/app/view-as-banner";

export const metadata = { robots: { index: false, follow: false } };

const TABS = [
  { href: "/admin", label: "Panel" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/notificaciones", label: "Notificaciones" },
  { href: "/admin/pagos", label: "Pagos con problemas" },
  { href: "/admin/planes", label: "Planes" },
  { href: "/admin/productos", label: "Productos y precios" },
  { href: "/admin/contenidos", label: "Contenidos" },
  { href: "/admin/incidencias", label: "Incidencias" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

/** Área exclusiva de administradores: control en servidor (requireAdmin) y en RLS. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { viewAs, supabase } = await requireAdmin();
  const { count: unread } = viewAs ? { count: 0 } : await supabase.from("admin_notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <div className="min-h-dvh bg-canvas">
      {viewAs ? <ViewAsBanner viewAs={viewAs} /> : null}
      <header className="nav-zone bg-nav text-nav-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3"><Logo inverted /><Badge tone="lime">Administración</Badge></div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/notificaciones"
              aria-label={unread ? `Notificaciones: ${unread} sin leer` : "Notificaciones"}
              className="relative inline-flex size-11 items-center justify-center rounded-xl text-nav-ink hover:bg-white/10"
            >
              <IconBell />
              {unread ? (
                <span aria-hidden="true" className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-accent px-1 text-center text-xs font-bold leading-5 text-on-accent">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
            <Link href="/inicio" className="text-sm font-semibold text-nav-muted hover:text-nav-ink">Volver a la app</Link>
          </div>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-nav-muted hover:bg-white/10 hover:text-nav-ink">{t.label}</Link>
          ))}
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">
        {viewAs ? (
          // En "ver como usuario" la base no da permisos de admin: primero hay que volver.
          <div role="status" className="rounded-2xl border border-primary bg-surface p-6">
            <p className="font-bold">Estás viendo la app como usuario {viewAs === "premium" ? "con suscripción" : "sin suscripción"}.</p>
            <p className="mt-1 text-sm text-muted">Para usar el panel, volvé a la vista de administrador con el botón del aviso de arriba.</p>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
