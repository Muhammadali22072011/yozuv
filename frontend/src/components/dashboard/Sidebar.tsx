"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
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
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { YzLogo } from "@/components/yz/Logo";

const SUPPORT_TG =
  process.env.NEXT_PUBLIC_SUPPORT_TG_URL || "https://t.me/zimdevuz";

const links = [
  { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Yozilishlar", icon: CalendarDays },
  { href: "/dashboard/services", label: "Xizmatlar", icon: Scissors },
  // Multi-staff page (PR #43/#49). Visible from day one — the empty
  // state nudges the owner to add their first master.
  { href: "/dashboard/staff", label: "Mutaxassislar", icon: UserCircle2 },
  { href: "/dashboard/schedule", label: "Ish vaqti", icon: ClipboardList },
  { href: "/dashboard/clients", label: "Mijozlar", icon: Users },
  { href: "/dashboard/promo", label: "Promo-kodlar", icon: Tag },
  { href: "/dashboard/reviews", label: "Baholar", icon: Star },
  { href: "/dashboard/analytics", label: "Analitika", icon: BarChart3 },
  { href: "/dashboard/qr", label: "QR / Broshyura", icon: QrCode },
  { href: "/dashboard/profile", label: "Profil", icon: User },
  { href: "/dashboard/settings", label: "Sozlamalar", icon: Settings },
];

export function Sidebar({ onAddBooking }: { onAddBooking?: () => void }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => {});
  }, []);

  const allLinks = isAdmin
    ? [...links, { href: "/dashboard/admin", label: "Admin", icon: Shield }]
    : links;

  return (
    <aside className="hidden w-64 shrink-0 bg-white shadow-[1px_0_0_rgba(229,231,240,0.8),8px_0_24px_-18px_rgba(11,15,31,0.18)] md:sticky md:top-0 md:flex md:h-screen md:flex-col md:self-start">
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

      <nav className="scroll flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {allLinks.map((l) => {
          const active =
            pathname === l.href || (l.href !== "/dashboard" && pathname?.startsWith(l.href + "/"));
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
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
              {l.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-3 pb-6">
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
        <Link
          href="/dashboard/settings"
          className="tap flex items-center gap-3 rounded-2xl bg-ink-50 px-3 py-2.5 text-sm font-semibold text-ink-700"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-ink-500 shadow-soft-sm">
            <CreditCard className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </span>
          To'lov
        </Link>
      </div>
    </aside>
  );
}
