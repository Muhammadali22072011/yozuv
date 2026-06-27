"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getActiveBusinessId, setActiveBusinessId } from "@/lib/api";

type Membership = {
  business_id: string;
  name: string;
  slug: string;
  logo_url: string;
  role: string;
  is_active: boolean;
};

/**
 * Header control for owners of more than one business: shows the active
 * business and lets them switch the whole dashboard to another, or add a
 * new one. Selecting a business persists it (X-Business-Id is sent on every
 * request) and reloads so all data + the SSE stream rebind to it.
 *
 * Renders nothing while the user has a single business — there's nothing to
 * switch between — but the dropdown still offers "add business" once they do
 * have more than one. (A first-time owner adds their second business from
 * Settings.)
 */
export function BusinessSwitcher() {
  const router = useRouter();
  const [items, setItems] = useState<Membership[] | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<Membership[]>("/api/business/memberships")
      .then((rows) => {
        if (!alive) return;
        setItems(rows);
        // Keep the stored active id in sync with reality: if nothing is
        // chosen yet (or it points at a business the user lost access to),
        // default to the first so the header and backend agree.
        const active = getActiveBusinessId();
        const valid = rows.some((r) => r.business_id === active);
        if (rows.length && !valid) setActiveBusinessId(rows[0].business_id);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Shown once the user owns at least one business — even a single business
  // is the entry point for "add another" in the dropdown. Hidden only while
  // they have none (the onboarding wizard covers that).
  if (!items || items.length === 0) return null;

  const activeId = getActiveBusinessId() || items[0].business_id;
  const active = items.find((i) => i.business_id === activeId) || items[0];

  const choose = (id: string) => {
    setOpen(false);
    if (id === activeId) return;
    setActiveBusinessId(id);
    // Hard reload so every page's data and the notification stream rebind to
    // the newly selected business — cheaper than threading a context through
    // dozens of pages.
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-ink-100 bg-white px-4 py-2.5 text-left shadow-sm transition hover:border-ink-200"
      >
        <span className="flex min-w-0 items-center gap-2">
          {active.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.logo_url}
              alt=""
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
              {active.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-sm font-semibold text-ink-900">
            {active.name}
          </span>
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-ink-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-lg">
          <ul className="max-h-72 overflow-y-auto py-1">
            {items.map((it) => (
              <li key={it.business_id}>
                <button
                  type="button"
                  onClick={() => choose(it.business_id)}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-ink-50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600">
                    {it.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink-900">
                    {it.name}
                  </span>
                  {it.business_id === activeId && (
                    <svg
                      className="h-4 w-4 shrink-0 text-emerald-600"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.3 3.29 6.8-6.79a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/onboarding?new=1");
            }}
            className="flex w-full items-center gap-2 border-t border-ink-100 px-4 py-2.5 text-left text-sm font-semibold text-indigo-600 hover:bg-ink-50"
          >
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-50 text-base leading-none text-indigo-600">
              +
            </span>
            Biznes qo&apos;shish
          </button>
        </div>
      )}
    </div>
  );
}
