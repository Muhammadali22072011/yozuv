"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Avatar, ScreenHeader } from "@/components/yz";
import { apiFetch } from "@/lib/api";

type Review = {
  id: string;
  booking_id: string | null;
  rating: number;
  comment: string;
  client_name: string;
  created_at: string;
};

type Summary = { average_rating: number; count: number };

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={i <= n ? "fill-lemon text-lemon" : "text-ink-300"}
          style={{ width: size, height: size }}
          strokeWidth={1.6}
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [sum, setSum] = useState<Summary>({ average_rating: 0, count: 0 });

  useEffect(() => {
    apiFetch<Review[]>("/api/business/me/reviews").then(setRows).catch(() => {});
    apiFetch<Summary>("/api/business/me/reviews/summary").then(setSum).catch(() => {});
  }, []);

  const total = sum.count || rows.length || 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: rows.filter((r) => r.rating === n).length,
  }));

  return (
    <div>
      <ScreenHeader title="Baholar" subtitle={`${total} ta sharh`} />

      <div className="mt-2 px-4 md:px-0">
        <div className="card-soft flex items-center gap-5 p-5">
          <div className="text-center">
            <div className="font-display text-5xl font-extrabold leading-none tracking-[-0.04em] text-ink-900">
              {sum.average_rating.toFixed(1)}
            </div>
            <div className="mt-1.5 flex justify-center">
              <Stars n={Math.round(sum.average_rating)} size={18} />
            </div>
            <div className="mt-1 text-[11px] font-semibold text-ink-400">{total} ta baho</div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            {dist.map((d) => (
              <div key={d.n} className="flex items-center gap-2">
                <div className="w-3 text-xs font-bold text-ink-500">{d.n}</div>
                {/* Bar share is per-rating count over the SAME population the
                    counts came from (loaded rows), not sum.count — mixing them
                    made the bars never reach 100%. */}
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-lemon"
                    style={{ width: `${rows.length ? (d.count / rows.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-4 text-right text-xs font-bold text-ink-400">{d.count}</div>
              </div>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-400">
            Hali sharh yo‘q
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-2.5">
            {rows.map((r) => (
              <div key={r.id} className="card-soft p-3.5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={r.client_name || "Mijoz"} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-display text-sm font-bold text-ink-900">
                      {r.client_name || "Mijoz"}
                    </div>
                    <div className="text-[11px] font-semibold text-ink-400">
                      {r.created_at.slice(0, 10)}
                    </div>
                  </div>
                  <Stars n={r.rating} />
                </div>
                {r.comment && (
                  <p className="mt-2.5 text-sm leading-relaxed text-ink-700">{r.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
