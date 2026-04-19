"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Review = {
  id: string;
  booking_id: string;
  rating: number;
  comment: string;
  client_name: string;
  created_at: string;
};

type Summary = { average_rating: number; count: number };

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= n ? "fill-ochre text-ochre" : "text-ink/20"}`}
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-2xl">Mijoz baholari</h2>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <div className="flex items-center gap-4">
          <div>
            <div className="font-serif text-4xl">{sum.average_rating.toFixed(1)}</div>
            <Stars n={Math.round(sum.average_rating)} />
          </div>
          <div className="text-sm text-ink/60">
            {sum.count} ta baho
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/10 bg-white p-6 text-center text-sm text-ink/60">
          Hali baho yo&apos;q. Mijozlar yozilishdan keyin baho qoldiradi.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-ink/10 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{r.client_name}</div>
                <Stars n={r.rating} />
              </div>
              {r.comment && <p className="mt-2 text-sm text-ink/70">{r.comment}</p>}
              <div className="mt-1 text-xs text-ink/50">
                {r.created_at.slice(0, 16).replace("T", " ")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
