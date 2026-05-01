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
  { href: "/dashboard/schedule", label: "Jadval", icon: ClipboardList },
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
    <aside className="hidden w-64 shrink-0 border-r border-ink-100 bg-white md:flex md:flex-col">
      <div className="flex items-center gap-2.5 px-6 pt-8 pb-5">
        <YzLogo size={32} variant="gradient" />
        <div>
          <div className="font-display text-[17px] font-extrabold tracking-tight text-ink-900">
            Yozuv
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
            Kabinet
          </div>
        </div>
      </div>

      {onAddBooking && (
        <div className="px-4 pb-4">
          <button onClick={onAddBooking} className="btn-primary w-full justify-center py-3.5 text-[15px]">
            <Plus className="mr-2 h-4 w-4" strokeWidth={2.8} /> Yangi yozilish
          </button>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-3 pb-6">
        {allLinks.map((l) => {
          const active =
            pathname === l.href || (l.href !== "/dashboard" && pathname?.startsWith(l.href + "/"));
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-ink-500 hover:bg-ink-50 hover:text-ink-900"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
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
          className="flex items-center gap-3 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-semibold text-indigo-700"
        >
          <LifeBuoy className="h-4 w-4" /> Yordam
        </a>
        <Link
          href="/dashboard/settings"
          className="flex items-center gap-3 rounded-xl bg-ink-50 px-3 py-2.5 text-sm font-semibold text-ink-700"
        >
          <CreditCard className="h-4 w-4" /> To'lov
        </Link>
      </div>
    </aside>
  );
}
