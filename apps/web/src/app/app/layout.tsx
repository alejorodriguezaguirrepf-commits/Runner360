import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { BottomNav, SideNav } from "@/components/app/app-nav";
import { Logo } from "@/components/logo";
import { isStaff, requireOnboardedViewer } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireOnboardedViewer();
  const staff = isStaff(viewer);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="on-dark sticky top-0 hidden h-dvh flex-col justify-between bg-navy p-5 lg:flex">
        <div className="space-y-8">
          <Logo dark href="/app" />
          <SideNav showAdmin={staff} />
        </div>
        <div className="space-y-3 border-t border-white/10 pt-4">
          <p className="truncate text-sm text-white/70" title={viewer.email}>{viewer.displayName ?? viewer.email}</p>
          <form action={signOutAction}>
            <button type="submit" className="flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white">
              <LogOut className="size-4" aria-hidden /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white px-4 lg:hidden">
          <Logo href="/app" />
        </header>
        <main id="contenido" className="mx-auto max-w-5xl px-4 pb-28 pt-6 lg:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
