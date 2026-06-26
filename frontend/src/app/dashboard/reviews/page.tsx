"use client";

import { useEffect, useState } from "react";
import { CornerDownRight, MessageSquareHeart, Star } from "lucide-react";
import { Avatar, ScreenHeader, useToast } from "@/components/yz";
import { apiFetch } from "@/lib/api";

type Review = {
  id: string;
  booking_id: string | null;
  rating: number;
  comment: string;
  client_name: string;
  created_at: string;
  owner_reply: string;
  replied_at: string | null;
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

function ReviewCard({
  r,
  onReplied,
}: {
  r: Review;
  onReplied: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(r.owner_reply || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/business/me/reviews/${r.id}/reply`, {
        method: "PUT",
        body: JSON.stringify({ reply: text.trim() }),
      });
      toast(text.trim() ? "Javob saqlandi" : "Javob o‘chirildi");
      setEditing(false);
      onReplied();
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-soft p-4">
      <div className="flex items-center gap-3">
        <Avatar name={r.client_name || "Mijoz"} size={40} />
        <div className="flex-1 min-w-0">
          <div className="truncate font-display text-sm font-bold tracking-tight text-ink-900">
            {r.client_name || "Mijoz"}
          </div>
          <div className="tnum text-[11px] font-semibold text-ink-400">
            {r.created_at.slice(0, 10)}
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-1">
          <Star className="h-3.5 w-3.5 fill-lemon text-lemon" strokeWidth={0} />
          <span className="tnum text-xs font-bold text-ink-700">{r.rating}</span>
        </span>
      </div>
      {r.comment && (
        <p className="mt-3 rounded-2xl bg-ink-50 px-3.5 py-2.5 text-sm leading-relaxed text-ink-700">
          {r.comment}
        </p>
      )}

      {r.owner_reply && !editing && (
        <div className="mt-2.5 flex gap-2 rounded-2xl bg-indigo-50 px-3.5 py-2.5">
          <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wide text-indigo-500">
              Sizning javobingiz
            </div>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-700">{r.owner_reply}</p>
          </div>
        </div>
      )}

      {editing ? (
        <div className="mt-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Mijozga javob yozing…"
            className="yz-input w-full resize-none text-sm"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={save}
              disabled={busy}
              className="btn-primary tap flex-1 justify-center py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? "…" : "Saqlash"}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setText(r.owner_reply || "");
              }}
              className="btn-soft tap px-4 py-2.5 text-sm"
            >
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="mt-2.5 text-xs font-bold text-indigo-600 tap"
        >
          {r.owner_reply ? "Javobni tahrirlash" : "Javob berish"}
        </button>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  const [rows, setRows] = useState<Review[]>([]);
  const [sum, setSum] = useState<Summary>({ average_rating: 0, count: 0 });

  function load() {
    apiFetch<Review[]>("/api/business/me/reviews").then(setRows).catch(() => {});
    apiFetch<Summary>("/api/business/me/reviews/summary").then(setSum).catch(() => {});
  }
  useEffect(() => {
    load();
  }, []);

  const total = sum.count || rows.length || 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: rows.filter((r) => r.rating === n).length,
  }));

  return (
    <div>
      <ScreenHeader title="Baholar" subtitle={`${total} ta sharh`} />

      <div className="mt-3 px-4 md:px-0">
        <div className="card flex items-center gap-5 p-5">
          <div
            className="flex min-w-[104px] flex-col items-center justify-center rounded-3xl px-4 py-5 text-white"
            style={{
              background: "linear-gradient(135deg,#7C5CFF 0%,#4853F5 100%)",
              boxShadow: "0 16px 32px -18px rgba(72,83,245,0.6)",
            }}
          >
            <div className="tnum font-display text-5xl font-extrabold leading-none tracking-tightest">
              {sum.average_rating.toFixed(1)}
            </div>
            <div className="mt-2 flex justify-center">
              <Stars n={Math.round(sum.average_rating)} size={16} />
            </div>
            <div className="mt-1.5 text-[11px] font-semibold text-white/70">
              {total} ta baho
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {dist.map((d) => (
              <div key={d.n} className="flex items-center gap-2.5">
                <div className="flex w-4 items-center gap-0.5 text-xs font-bold text-ink-500">
                  {d.n}
                  <Star className="h-2.5 w-2.5 fill-lemon text-lemon" strokeWidth={0} />
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-lemon transition-all"
                    style={{ width: `${total ? (d.count / total) * 100 : 0}%` }}
                  />
                </div>
                <div className="tnum w-5 text-right text-xs font-bold text-ink-400">{d.count}</div>
              </div>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="card-soft mt-4 flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-danger-bg">
              <MessageSquareHeart className="h-6 w-6 text-coral" strokeWidth={1.8} />
            </div>
            <div className="text-sm font-semibold text-ink-400">Hali sharh yo‘q</div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {rows.map((r) => (
              <ReviewCard key={r.id} r={r} onReplied={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
