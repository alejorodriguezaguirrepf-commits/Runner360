import Link from "next/link";
import { BottomNav, MobileMoreLinks, SideNav } from "@/components/app/app-nav";
import { IconLogout, Logo } from "@/components/ui/icons";
import { requireOnboardedSession } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";
import { stopViewAsAction } from "@/lib/actions/view-as";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, viewAs } = await requireOnboardedSession();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="nav-zone sticky top-0 hidden h-dvh flex-col justify-between overflow-y-auto bg-nav p-4 lg:flex">
        <div className="space-y-8">
          <Link href="/inicio" className="block px-2 pt-2" aria-label="RUNNER 360, inicio">
            <Logo inverted />
          </Link>
          <SideNav isAdmin={isAdmin} />
        </div>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-nav-muted hover:bg-white/10 hover:text-nav-ink">
            <IconLogout />
            Cerrar sesión
          </button>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
          <Link href="/inicio" aria-label="RUNNER 360, inicio"><Logo /></Link>
          <form action={signOutAction}>
            <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted" aria-label="Cerrar sesión">
              <IconLogout />
            </button>
          </form>
        </header>
        <main id="contenido" className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">
          {viewAs ? (
            <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary bg-surface-2 px-4 py-3 text-sm">
              <p>
                <span className="font-bold">Vista de usuario {viewAs === "premium" ? "con suscripción" : "sin suscripción"}.</span>{" "}
                <span className="text-muted">Ves la app como la ve esa persona.</span>
              </p>
              <form action={stopViewAsAction}>
                <button type="submit" className="min-h-11 rounded-xl bg-primary px-4 font-semibold text-on-primary">Volver a administrador</button>
              </form>
            </div>
          ) : null}
          <MobileMoreLinks isAdmin={isAdmin} />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
