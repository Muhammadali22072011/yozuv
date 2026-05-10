"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutGrid,
  LifeBuoy,
  LucideIcon,
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
import { SheetBody, SheetContent, SheetHeader, SheetRoot } from "./Sheet";

const SUPPORT_TG =
  process.env.NEXT_PUBLIC_SUPPORT_TG_URL || "https://t.me/zimdevuz";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const tabs: Tab[] = [
  { href: "/dashboard", label: "Asosiy", icon: Home },
  { href: "/dashboard/bookings", label: "Jadval", icon: CalendarDays },
  { href: "/dashboard/clients", label: "Mijozlar", icon: Users },
];

type MoreLink = { href: string; label: string; icon: LucideIcon; tone?: "indigo" | "mint" | "lemon" | "coral" | "lilac" | "sky" };

const moreLinks: MoreLink[] = [
  { href: "/dashboard/analytics", label: "Analitika", icon: BarChart3, tone: "sky" },
  { href: "/dashboard/services", label: "Xizmatlar", icon: Scissors, tone: "indigo" },
  // Multi-staff CRUD (PR #43/#49). Visible even when no staff yet so
  // the owner can find the page and onboard their first master.
  { href: "/dashboard/staff", label: "Mutaxassislar", icon: UserCircle2, tone: "lilac" },
  { href: "/dashboard/schedule", label: "Ish vaqti", icon: ClipboardList, tone: "mint" },
  { href: "/dashboard/promo", label: "Promo-kodlar", icon: Tag, tone: "mint" },
  { href: "/dashboard/reviews", label: "Baholar", icon: Star, tone: "lemon" },
  { href: "/dashboard/qr", label: "QR / Broshyura", icon: QrCode, tone: "lemon" },
  { href: "/dashboard/profile", label: "Profil", icon: User, tone: "lilac" },
  { href: "/dashboard/settings", label: "Sozlamalar", icon: Settings, tone: "coral" },
];

const toneStyles: Record<NonNullable<MoreLink["tone"]>, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  mint: "bg-[#E6FAF3] text-[#0E9577]",
  lemon: "bg-[#FFF3DA] text-[#A8751A]",
  coral: "bg-[#FFE7E3] text-[#C93A2A]",
  lilac: "bg-[#F0EBFF] text-[#6B4FE0]",
  sky: "bg-[#E5F4FF] text-[#2A7DC2]",
};

export function TabBar({ onAdd }: { onAdd?: () => void }) {
  const pathname = usePathname() || "";
  const [moreOpen, setMoreOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ is_admin?: boolean }>("/api/auth/me")
      .then((u) => setIsAdmin(!!u?.is_admin))
      .catch(() => {});
  }, []);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  const moreActive = moreLinks.some((l) => isActive(l.href));

  const allMore: MoreLink[] = isAdmin
    ? [...moreLinks, { href: "/dashboard/admin", label: "Admin", icon: Shield, tone: "coral" }]
    : moreLinks;

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-900/5 bg-white/88 pb-7 pt-2.5 backdrop-blur-xl backdrop-saturate-150 md:hidden"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 20px)" }}
      >
        <div className="flex items-center justify-around">
          {tabs.slice(0, 2).map((t) => (
            <TabItem key={t.href} tab={t} active={isActive(t.href)} />
          ))}
          <button
            onClick={onAdd}
            className="-mt-6 grid h-14 w-14 place-items-center rounded-[20px] yz-grad text-white shadow-indigo"
            aria-label="Yangi yozilish"
          >
            <Plus className="h-6 w-6" strokeWidth={2.8} />
          </button>
          {tabs.slice(2).map((t) => (
            <TabItem key={t.href} tab={t} active={isActive(t.href)} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-1",
              moreActive ? "text-indigo-600" : "text-ink-400"
            )}
            aria-label="Yana"
          >
            <LayoutGrid className="h-[22px] w-[22px]" strokeWidth={2} />
            <span className="font-display text-[11px] font-semibold">Yana</span>
          </button>
        </div>
      </nav>

      <SheetRoot open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent height="tall">
          <SheetHeader title="Yana" onClose={() => setMoreOpen(false)} />
          <SheetBody>
            <div className="grid grid-cols-2 gap-2.5">
              {allMore.map((l) => {
                const Icon = l.icon;
                const tone = l.tone ?? "indigo";
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-[18px] border bg-white p-3.5 tap",
                      active ? "border-indigo-200 ring-2 ring-indigo-200/60" : "border-ink-100"
                    )}
                  >
                    <span className={cn("grid h-10 w-10 place-items-center rounded-xl", toneStyles[tone])}>
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <span className="min-w-0 flex-1 font-display text-sm font-extrabold tracking-tight text-ink-900">
                      {l.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-300" strokeWidth={2.4} />
                  </Link>
                );
              })}
            </div>

            <a
              href={SUPPORT_TG}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMoreOpen(false)}
              className="mt-3 flex items-center gap-3 rounded-[18px] bg-indigo-50 p-3.5 text-indigo-700 tap"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white text-indigo-600">
                <LifeBuoy className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-sm font-extrabold tracking-tight">
                  Yordam kerakmi?
                </span>
                <span className="mt-0.5 block text-xs font-semibold text-indigo-700/70">
                  Telegram orqali yozing
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-indigo-400" strokeWidth={2.4} />
            </a>
          </SheetBody>
        </SheetContent>
      </SheetRoot>
    </>
  );
}

function TabItem({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-1",
        active ? "text-indigo-600" : "text-ink-400"
      )}
    >
      <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      <span className="font-display text-[11px] font-semibold">{tab.label}</span>
    </Link>
  );
}
