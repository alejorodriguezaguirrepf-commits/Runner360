"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBolt,
  IconBook,
  IconCalendar,
  IconChart,
  IconDrop,
  IconFlag,
  IconHome,
  IconList,
  IconPhone,
  IconPlus,
  IconSettings,
  IconStar,
  IconTimer,
  IconUser,
} from "@/components/ui/icons";
import { cx } from "@/components/ui/primitives";
import { t } from "@/i18n";

const PRIMARY = [
  { href: "/inicio", label: "Inicio", icon: IconHome },
  { href: "/plan", label: "Plan", icon: IconCalendar },
  { href: "/registrar", label: "Registrar", icon: IconPlus },
  { href: "/progreso", label: "Progreso", icon: IconChart },
  { href: "/perfil", label: "Perfil", icon: IconUser },
];

const SECONDARY = [
  { href: "/hoy", label: t.library.today.title, icon: IconTimer },
  { href: "/planes", label: t.library.nav.catalog, icon: IconList },
  { href: "/calculadora", label: "Calculadora", icon: IconBolt },
  { href: "/entrenamientos", label: "Historial", icon: IconTimer },
  { href: "/hidratacion", label: "Hidratación", icon: IconDrop },
  { href: "/competencias", label: "Competencias", icon: IconFlag },
  { href: "/aprender", label: "Aprender", icon: IconBook },
  { href: "/suscripcion", label: "Suscripción", icon: IconStar },
  { href: "/instalar", label: "Instalar app", icon: IconPhone },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [...PRIMARY, ...SECONDARY, ...(isAdmin ? [{ href: "/admin", label: "Administración", icon: IconSettings }] : [])];
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              active ? "bg-accent text-on-accent" : "text-nav-muted hover:bg-white/10 hover:text-nav-ink",
            )}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegación inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const isCta = href === "/registrar";
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx("flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold", active ? "text-primary-ink" : "text-muted")}
              >
                <span className={cx("inline-flex items-center justify-center rounded-full", isCta ? "size-9 bg-primary text-on-primary" : active ? "text-primary-ink" : "")}>
                  <Icon />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileMoreLinks({ isAdmin }: { isAdmin: boolean }) {
  const items = [...SECONDARY, ...(isAdmin ? [{ href: "/admin", label: "Administración", icon: IconSettings }] : [])];
  return (
    <nav aria-label="Secciones" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:border-primary">
          <Icon width={16} height={16} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
