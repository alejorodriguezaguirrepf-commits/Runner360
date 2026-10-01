import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { Badge } from "@/components/ui/badge";
import { isAdmin, requireStaff } from "@/lib/auth";

const LINKS = [
  { href: "/admin", label: "Panel", admin: false },
  { href: "/admin/usuarios", label: "Usuarios", admin: true },
  { href: "/admin/planes", label: "Planes", admin: false },
  { href: "/admin/productos", label: "Productos y precios", admin: true },
  { href: "/admin/contenidos", label: "Contenidos", admin: false },
  { href: "/admin/incidencias", label: "Incidencias", admin: true },
  { href: "/admin/auditoria", label: "Auditoría", admin: true },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaff();
  const admin = isAdmin(viewer);
  return (
    <div className="min-h-dvh">
      <header className="on-dark bg-navy text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo dark href="/admin" />
            <Badge tone="lime">{admin ? "Administrador" : "Entrenador"}</Badge>
          </div>
          <Link href="/app" className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"><ArrowLeft className="size-4" aria-hidden /> Volver a la app</Link>
        </div>
        <nav aria-label="Administración" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {LINKS.filter((l) => admin || !l.admin).map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white">{l.label}</Link>
          ))}
        </nav>
      </header>
      <main id="contenido" className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
