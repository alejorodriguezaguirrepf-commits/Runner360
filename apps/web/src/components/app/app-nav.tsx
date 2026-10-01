"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CreditCard,
  Droplets,
  Flag,
  History,
  Home,
  LineChart,
  PlusCircle,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/cn";

type Item = { href: string; label: string; Icon: LucideIcon };

const PRIMARY: Item[] = [
  { href: "/app", label: "Inicio", Icon: Home },
  { href: "/app/plan", label: "Plan", Icon: CalendarDays },
  { href: "/app/registrar", label: "Registrar", Icon: PlusCircle },
  { href: "/app/progreso", label: "Progreso", Icon: LineChart },
  { href: "/app/perfil", label: "Perfil", Icon: UserRound },
];

const SECONDARY: Item[] = [
  { href: "/app/historial", label: "Historial", Icon: History },
  { href: "/app/hidratacion", label: "Hidratación", Icon: Droplets },
  { href: "/app/competencias", label: "Competencias", Icon: Flag },
  { href: "/app/contenidos", label: "Aprender", Icon: BookOpen },
  { href: "/app/suscripcion", label: "Suscripción", Icon: CreditCard },
];

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ showAdmin }: { showAdmin: boolean }) {
  const pathname = usePathname();
  const items = [...PRIMARY, ...SECONDARY, ...(showAdmin ? [{ href: "/admin", label: "Administración", Icon: Shield }] : [])];
  return (
    <nav aria-label="Secciones" className="space-y-1">
      {items.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
              active ? "bg-lime text-navy" : "text-white/80 hover:bg-white/10 hover:text-white",
            )}
          >
            <Icon className="size-5" aria-hidden />
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
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5">
        {PRIMARY.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-navy" : "text-muted")}
              >
                <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && "bg-lime")}>
                  <Icon className="size-5" aria-hidden />
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

export function MobileMoreLinks({ showAdmin }: { showAdmin: boolean }) {
  const items = [...SECONDARY, ...(showAdmin ? [{ href: "/admin", label: "Administración", Icon: Shield }] : [])];
  return (
    <nav aria-label="Más secciones" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
      {items.map(({ href, label, Icon }) => (
        <Link key={href} href={href} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-sm font-medium text-navy">
          <Icon className="size-5" aria-hidden /> {label}
        </Link>
      ))}
    </nav>
  );
}
