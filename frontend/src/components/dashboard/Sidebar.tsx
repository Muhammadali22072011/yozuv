"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  Menu,
  QrCode,
  Scissors,
  Settings,
  Shield,
  Star,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { Logo } from "@/components/Logo";

const links = [
  { href: "/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/dashboard/bookings", label: "Yozilishlar", icon: CalendarDays },
  { href: "/dashboard/services", label: "Xizmatlar", icon: Scissors },
  { href: "/dashboard/schedule", label: "Jadval", icon: CalendarDays },
  { href: "/dashboard/clients", label: "Mijozlar", icon: Users },
  { href: "/dashboard/promo", label: "Promo-kodlar", icon: Tag },
  { href: "/dashboard/reviews", label: "Baholar", icon: Star },
  { href: "/dashboard/analytics", label: "Analitika", icon: BarChart3 },
  { href: "/dashboard/qr", label: "QR / Broshyura", icon: QrCode },
  { href: "/dashboard/profile", label: "Profil", icon: User },
  { href: "/dashboard/settings", label: "To'lov", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const allLinks = isAdmin
    ? [...links, { href: "/dashboard/admin", label: "Admin", icon: Shield }]
    : links;

  const NavList = (
    <nav className="space-y-1 px-3 pb-8">
      {allLinks.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
              active ? "bg-ink text-white" : "text-ink/70 hover:bg-cream"
            )}
          >
            <l.icon className="h-4 w-4" />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-ink/10 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="rounded-md p-2 hover:bg-cream"
            aria-label="Menyu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo size={22} />
        </div>
        {isAdmin && (
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-1 rounded-md bg-ink px-3 py-1.5 text-xs text-white"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </Link>
        )}
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-6">
              <div>
                <Logo size={28} />
                <p className="mt-1 text-xs text-ink/50">Dashboard</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-2 hover:bg-cream"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {NavList}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-ink/10 bg-white md:block">
        <div className="px-6 py-8">
          <Logo size={28} />
          <p className="mt-2 text-xs text-ink/50">Dashboard</p>
        </div>
        {NavList}
      </aside>
    </>
  );
}
