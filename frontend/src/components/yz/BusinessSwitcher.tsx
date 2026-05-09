"use client";

import { useEffect, useState } from "react";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import {
  apiFetch,
  getActiveBusinessId,
  setActiveBusinessId,
  apiBase,
} from "@/lib/api";

type Membership = {
  business_id: string;
  name: string;
  slug: string;
  logo_url: string;
  role: "OWNER" | "MANAGER" | "STAFF";
  is_active: boolean;
};

const ROLE_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  OWNER: { label: "Egasi", bg: "#EEF0FF", fg: "#1F2C7F" },
  MANAGER: { label: "Manager", bg: "#FFF3DA", fg: "#5C3F0A" },
  STAFF: { label: "Mutaxassis", bg: "#E6FAF3", fg: "#0F5A4B" },
};

/**
 * Floating chip that shows the active business and lets the owner
 * switch between every business they're a member of.
 *
 * Hidden when the user has only one membership — most owners stay in
 * the single-business case forever, and a chip that has nothing to do
 * is just noise.
 *
 * Switching writes the new business id to localStorage (where api.ts
 * picks it up for X-Business-Id) and reloads the page so every cached
 * fetch picks up the change. A SPA-level state refresh would be
 * cleaner but every page in /dashboard fetches its own bundle on mount,
 * and a full reload is two seconds we'd rather spend than chase
 * stragglers.
 */
export function BusinessSwitcher() {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Membership[]>("/api/business/memberships")
      .then((rows) => setMemberships(rows))
      .catch(() => setMemberships([]));
    setActiveId(getActiveBusinessId());
  }, []);

  if (!memberships || memberships.length <= 1) return null;

  const active =
    memberships.find((m) => m.business_id === activeId) || memberships[0];

  function pick(m: Membership) {
    if (m.business_id === active.business_id) {
      setOpen(false);
      return;
    }
    setActiveBusinessId(m.business_id);
    // Hard reload so every component picks up the new X-Business-Id
    // on its next fetch. Cheaper than wiring a global "biz changed"
    // event into every page.
    window.location.reload();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-2xl bg-white/14 px-3 py-2 text-white backdrop-blur tap"
        aria-label="Biznesni almashtirish"
      >
        {active.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              active.logo_url.startsWith("http")
                ? active.logo_url
                : `${apiBase()}${active.logo_url}`
            }
            alt={active.name}
            className="h-6 w-6 rounded-md object-cover"
          />
        ) : (
          <Building2 className="h-4 w-4 text-white/80" />
        )}
        <span className="max-w-[110px] truncate text-xs font-bold">
          {active.name}
        </span>
        <ChevronDown className="h-3 w-3 text-white/70" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl bg-white text-ink-900 shadow-soft-lg">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Biznes
            </div>
            <div className="max-h-72 overflow-y-auto">
              {memberships.map((m) => {
                const isActive = m.business_id === active.business_id;
                const badge = ROLE_BADGE[m.role] || ROLE_BADGE.OWNER;
                return (
                  <button
                    key={m.business_id}
                    onClick={() => pick(m)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-ink-50 ${
                      isActive ? "bg-indigo-50" : ""
                    }`}
                  >
                    {m.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          m.logo_url.startsWith("http")
                            ? m.logo_url
                            : `${apiBase()}${m.logo_url}`
                        }
                        alt={m.name}
                        className="h-9 w-9 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink-100 text-ink-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-display text-sm font-bold">
                        {m.name}
                      </div>
                      <div
                        className="mt-0.5 inline-block rounded-full px-1.5 text-[10px] font-bold"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {badge.label}
                      </div>
                    </div>
                    {isActive && (
                      <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-ink-100 bg-ink-50 px-3 py-2">
              <a
                href="/dashboard/onboarding"
                className="flex items-center gap-2 text-xs font-bold text-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Yangi biznes ochish
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
