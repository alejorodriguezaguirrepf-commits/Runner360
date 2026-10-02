import Link from "next/link";
import { BottomNav, MobileMoreLinks, SideNav } from "@/components/app/app-nav";
import { IconLogout, Logo } from "@/components/ui/icons";
import { requireOnboardedSession } from "@/lib/auth";
import { signOutAction } from "@/lib/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireOnboardedSession();
  const isAdmin = profile.role === "admin";
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="dark-zone sticky top-0 hidden h-dvh flex-col justify-between bg-navy-900 p-4 lg:flex">
        <div className="space-y-8">
          <Link href="/inicio" className="block px-2 pt-2" aria-label="RUNNER 360, inicio">
            <Logo inverted />
          </Link>
          <SideNav isAdmin={isAdmin} />
        </div>
        <form action={signOutAction}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">
            <IconLogout />
            Cerrar sesión
          </button>
        </form>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
          <Link href="/inicio" aria-label="RUNNER 360, inicio"><Logo /></Link>
          <form action={signOutAction}>
            <button type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-muted" aria-label="Cerrar sesión">
              <IconLogout />
            </button>
          </form>
        </header>
        <main id="contenido" className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">
          <MobileMoreLinks isAdmin={isAdmin} />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
