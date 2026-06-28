"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  Plus,
  QrCode,
  Scissors,
  Settings,
  Shield,
  Star,
  Tag,
  User,
  UserCircle2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { YzLogo } from "@/components/yz/Logo";

const SUPPORT_TG =
  process.env.NEXT_PUBLIC_SUPPORT_TG_URL || "https://t.me/zimdevuz";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { eyebrow: string; items: NavItem[] };

// Canonical navigation order — the single source of truth shared by the
// desktop Sidebar and the mobile TabBar "Yana" sheet. Grouped into quiet
// sections so a 13-item list reads as three short clusters instead of one
// long scroll. Keep this in sync; do not re-order per surface.
export const NAV_SECTIONS: NavSection[] = [
  {
    eyebrow: "Kunlik ish",
    items: [
      { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
      { href: "/dashboard/bookings", label: "Yozilishlar", icon: CalendarDays },
      { href: "/dashboard/clients", label: "Mijozlar", icon: Users },
    ],
  },
  {
    eyebrow: "Sozlash",
    items: [
      { href: "/dashboard/services", label: "Xizmatlar", icon: Scissors },
      // Multi-staff page (PR #43/#49). Visible from day one — the empty
      // state nudges the owner to add their first master.
      { href: "/dashboard/staff", label: "Mutaxassislar", icon: UserCircle2 },
      { href: "/dashboard/schedule", label: "Ish vaqti", icon: ClipboardList },
      { href: "/dashboard/profile", label: "Profil", icon: User },
    ],
  },
  {
    eyebrow: "O'sish",
    items: [
      { href: "/dashboard/promo", label: "Promo-kodlar", icon: Tag },
      { href: "/dashboard/qr", label: "QR / Broshyura", icon: QrCode },
      { href: "/dashboard/referral", label: "Do'st taklif", icon: Gift },
      { href: "/dashboard/reviews", label: "Baholar", icon: Star },
      { href: "/dashboard/analytics", label: "Analitika", icon: BarChart3 },
    ],
  },
];

// Flat canonical order (e.g. for the mobile "Yana" grid), derived from the
// sections above so there is exactly one ordering to maintain.
export const NAV_FLAT: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function Sidebar({ onAddBooking }: { onAddBooking?: () => void }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => {});
  }, []);

  const active = (href: string) =>
    pathname === href || (href !== "/dashboard" && !!pathname?.startsWith(href + "/"));

  return (
    <aside className="hidden w-64 shrink-0 bg-white shadow-[1px_0_0_rgba(229,231,240,0.8),8px_0_24px_-18px_rgba(11,15,31,0.18)] md:flex md:flex-col">
      <div className="flex items-center gap-3 px-6 pt-8 pb-6">
        <YzLogo size={34} variant="gradient" />
        <div>
          <div className="font-display text-[18px] font-extrabold tracking-tight text-ink-900">
            Yozuv
          </div>
          <div className="eyebrow">Kabinet</div>
        </div>
      </div>

      {onAddBooking && (
        <div className="px-4 pb-5">
          <button
            onClick={onAddBooking}
            className="btn-primary tap w-full justify-center py-3.5 text-[15px]"
          >
            <Plus className="mr-2 h-4 w-4" strokeWidth={2.8} /> Yangi yozilish
          </button>
        </div>
      )}

      <nav className="scroll flex-1 overflow-y-auto px-3 pb-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.eyebrow} className="mb-4 last:mb-0">
            <div className="eyebrow px-3 pb-1.5 pt-1 text-ink-400">{section.eyebrow}</div>
            <div className="space-y-1">
              {section.items.map((l) => (
                <NavLink key={l.href} item={l} active={active(l.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-2 px-3 pb-6">
        <div className="eyebrow px-3 pb-1.5 text-ink-400">Sozlamalar</div>
        <Link
          href="/dashboard/settings"
          className={cn(
            "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
            active("/dashboard/settings")
              ? "bg-indigo-50 text-indigo-700 shadow-soft-sm"
              : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
          )}
        >
          {active("/dashboard/settings") && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-indigo-600" />
          )}
          <span
            className={cn(
              "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors",
              active("/dashboard/settings")
                ? "bg-white/80 text-indigo-700 shadow-soft-sm"
                : "text-ink-400 group-hover:text-ink-700"
            )}
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          Sozlamalar
        </Link>
        <Link
          href="/dashboard/settings#obuna"
          className="tap flex items-center gap-3 rounded-2xl bg-ink-50 px-3 py-2.5 text-sm font-semibold text-ink-700"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-ink-500 shadow-soft-sm">
            <CreditCard className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          Obuna va to'lov
        </Link>
        {isAdmin && (
          <Link
            href="/dashboard/admin"
            className={cn(
              "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active("/dashboard/admin")
                ? "bg-indigo-50 text-indigo-700 shadow-soft-sm"
                : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
            )}
          >
            {active("/dashboard/admin") && (
              <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-indigo-600" />
            )}
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors",
                active("/dashboard/admin")
                  ? "bg-white/80 text-indigo-700 shadow-soft-sm"
                  : "text-ink-400 group-hover:text-ink-700"
              )}
            >
              <Shield className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            Admin
          </Link>
        )}
        <a
          href={SUPPORT_TG}
          target="_blank"
          rel="noopener noreferrer"
          className="tap flex items-center gap-3 rounded-2xl bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/80 text-indigo-600 shadow-soft-sm">
            <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          Yordam
        </a>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-indigo-50 text-indigo-700 shadow-soft-sm"
          : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-indigo-600" />
      )}
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors",
          active
            ? "bg-white/80 text-indigo-700 shadow-soft-sm"
            : "text-ink-400 group-hover:text-ink-700"
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
      </span>
      {item.label}
    </Link>
  );
}
