"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Home,
  LayoutGrid,
  LifeBuoy,
  LucideIcon,
  Plus,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { NAV_FLAT, type NavItem } from "@/components/dashboard/Sidebar";
import { SheetBody, SheetContent, SheetHeader, SheetRoot } from "./Sheet";

const SUPPORT_TG =
  process.env.NEXT_PUBLIC_SUPPORT_TG_URL || "https://t.me/zimdevuz";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Primary thumb-reach tabs == the "Kunlik ish" cluster from the canonical
// nav. Short labels are intentional for the bottom bar; the hrefs/order
// stay aligned with NAV_FLAT so nothing drifts between surfaces.
const tabs: Tab[] = [
  { href: "/dashboard", label: "Asosiy", icon: Home },
  { href: "/dashboard/bookings", label: "Jadval", icon: CalendarDays },
  { href: "/dashboard/clients", label: "Mijozlar", icon: Users },
];

const PRIMARY_HREFS = new Set(tabs.map((t) => t.href));

type MoreLink = NavItem;

// Everything that isn't a primary tab, in canonical order, plus Sozlamalar
// (which lives in the desktop sidebar footer, not in NAV_FLAT).
const moreLinks: MoreLink[] = [
  ...NAV_FLAT.filter((l) => !PRIMARY_HREFS.has(l.href)),
  { href: "/dashboard/settings", label: "Sozlamalar", icon: Settings },
];

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
    ? [...moreLinks, { href: "/dashboard/admin", label: "Admin", icon: Shield }]
    : moreLinks;

  return (
    <>
      <nav
        className="fixed inset-x-3 z-40 rounded-[26px] border border-white/60 bg-white/85 px-2 py-2 shadow-soft-lg backdrop-blur-xl backdrop-saturate-150 md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        <div className="flex items-center justify-around">
          {tabs.slice(0, 2).map((t) => (
            <TabItem key={t.href} tab={t} active={isActive(t.href)} />
          ))}
          <button
            onClick={onAdd}
            className="-mt-7 grid h-14 w-14 place-items-center rounded-[20px] yz-grad text-white shadow-indigo tap"
            aria-label="Yangi yozilish"
          >
            <Plus className="h-6 w-6" strokeWidth={2.8} />
          </button>
          {tabs.slice(2).map((t) => (
            <TabItem key={t.href} tab={t} active={isActive(t.href)} />
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="group flex flex-1 flex-col items-center gap-1 py-0.5"
            aria-label="Yana"
          >
            <span
              className={cn(
                "tap-icon grid h-9 w-9 place-items-center rounded-2xl transition-colors group-active:scale-[0.82]",
                moreActive ? "bg-indigo-50 text-indigo-600" : "text-ink-400"
              )}
            >
              <LayoutGrid className="h-[21px] w-[21px]" strokeWidth={2} />
            </span>
            <span
              className={cn(
                "font-display text-[11px] font-semibold",
                moreActive ? "text-indigo-600" : "text-ink-400"
              )}
            >
              Yana
            </span>
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
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-3xl border bg-white p-3.5 shadow-soft-sm tap",
                      active ? "border-indigo-200 ring-2 ring-indigo-200/60" : "border-ink-100"
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-2xl transition-colors",
                        active ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
                      )}
                    >
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
    <Link href={tab.href} className="group flex flex-1 flex-col items-center gap-1 py-0.5">
      <span
        // key пере-монтирует пилюлю при активации → каждый раз заново
        // проигрывается pop-in (иконка «выскакивает» при выборе вкладки).
        key={active ? "on" : "off"}
        className={cn(
          "tap-icon grid h-9 w-9 place-items-center rounded-2xl transition-colors group-active:scale-[0.82]",
          active ? "animate-pop-in bg-indigo-50 text-indigo-600" : "text-ink-400"
        )}
      >
        <Icon className="h-[21px] w-[21px]" strokeWidth={2} />
      </span>
      <span
        className={cn(
          "font-display text-[11px] font-semibold",
          active ? "text-indigo-600" : "text-ink-400"
        )}
      >
        {tab.label}
      </span>
    </Link>
  );
}
