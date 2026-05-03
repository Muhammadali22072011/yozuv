"use client";

import { useRouter } from "next/navigation";
import { Bell, Calendar, Star, Wallet, X } from "lucide-react";
import { SheetContent, SheetRoot } from "./Sheet";

export type NotificationItem = {
  id: string;
  type:
    | "booking_new"
    | "booking_cancelled"
    | "review_new"
    | "subscription_expiring"
    | "subscription_expired";
  title: string;
  body: string;
  created_at: string;
  link?: string;
};

const ICONS: Record<NotificationItem["type"], { icon: typeof Bell; bg: string; fg: string }> = {
  booking_new: { icon: Calendar, bg: "bg-indigo-50", fg: "text-indigo-700" },
  booking_cancelled: { icon: Calendar, bg: "bg-[#FFE7E3]", fg: "text-[#C93A2A]" },
  review_new: { icon: Star, bg: "bg-[#FFF3DA]", fg: "text-[#A8751A]" },
  subscription_expiring: { icon: Wallet, bg: "bg-[#FFF3DA]", fg: "text-[#A8751A]" },
  subscription_expired: { icon: Wallet, bg: "bg-[#FFE7E3]", fg: "text-[#C93A2A]" },
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, (Date.now() - t) / 1000);
  if (diff < 60) return "hozir";
  if (diff < 3600) return `${Math.floor(diff / 60)} daq oldin`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} soat oldin`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} kun oldin`;
  return iso.slice(0, 10);
}

export function NotificationSheet({
  open,
  onClose,
  items,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  items: NotificationItem[];
  loading?: boolean;
}) {
  const router = useRouter();
  return (
    <SheetRoot open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent height="tall">
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="font-display text-lg font-extrabold text-ink-900">
            Bildirishnomalar
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-ink-500 hover:bg-ink-100"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          {loading && (
            <div className="px-3 py-12 text-center text-sm text-ink-400">
              Yuklanmoqda…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="px-3 py-12 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink-100 text-ink-400">
                <Bell className="h-6 w-6" />
              </div>
              <div className="mt-3 font-display text-sm font-extrabold text-ink-700">
                Hozircha hech narsa yo‘q
              </div>
              <div className="mt-1 text-xs text-ink-400">
                Yangi bron yoki izoh bo‘lganda shu yerda chiqadi.
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            {items.map((n) => {
              const meta = ICONS[n.type];
              const Icon = meta.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    if (n.link) {
                      router.push(n.link);
                      onClose();
                    }
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl bg-white p-3 text-left tap hover:bg-ink-50"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.bg} ${meta.fg}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="truncate font-display text-sm font-extrabold text-ink-900">
                        {n.title}
                      </div>
                      <div className="shrink-0 text-[10px] font-semibold text-ink-400">
                        {relTime(n.created_at)}
                      </div>
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[12px] text-ink-600">
                      {n.body}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SheetContent>
    </SheetRoot>
  );
}
