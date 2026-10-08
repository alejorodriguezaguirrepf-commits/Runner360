import Link from "next/link";
import { Logo } from "@/components/ui/icons";
import { Badge } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";

const TABS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/planes", label: "Planes" },
  { href: "/admin/productos", label: "Productos y precios" },
  { href: "/admin/contenidos", label: "Contenidos" },
  { href: "/admin/incidencias", label: "Incidencias" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

/** Área exclusiva de administradores: control en servidor (requireAdmin) y en RLS. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="dark-zone bg-navy-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3"><Logo inverted /><Badge tone="lime">Administración</Badge></div>
          <Link href="/inicio" className="text-sm font-semibold text-white/80 hover:text-white">Volver a la app</Link>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">{t.label}</Link>
          ))}
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
