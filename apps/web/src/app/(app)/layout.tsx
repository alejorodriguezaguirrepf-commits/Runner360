import Link from "next/link";
import { BottomNav, MobileMoreLinks, SideNav } from "@/components/app/app-nav";
import { IconLogout, Logo } from "@/components/ui/icons";
import { annualAccessUntil, requireOnboardedSession } from "@/lib/auth";
import { AnnualExpiryNotice } from "@/components/app/annual-notice";
import { signOutAction } from "@/lib/actions/auth";
import { ViewAsBanner } from "@/components/app/view-as-banner";
import { InstallBanner } from "@/components/pwa/install";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOnboardedSession();
  const { isAdmin, viewAs } = session;
  const annualUntil = await annualAccessUntil(session);
  return (
    <>
    {viewAs ? <ViewAsBanner viewAs={viewAs} /> : null}
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
          <AnnualExpiryNotice until={annualUntil} />
          <InstallBanner />
          <MobileMoreLinks isAdmin={isAdmin} />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
    </>
  );
}
