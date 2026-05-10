"use client";

import { Sparkles, ArrowRight } from "lucide-react";

/**
 * One-shot welcome modal shown the very first time an owner opens the
 * dashboard (gated by tour-state). Two-action footer:
 *   "Qisqa tur ko'rsatish" — start the on-screen guided tour.
 *   "O'zim ko'raman"        — skip and never show again.
 *
 * Keep the copy short and concrete: the user opened the app to do a
 * thing, not to read a book. Three bullets, one CTA, get out of the way.
 */
export function WelcomeModal({
  open,
  ownerName,
  onTour,
  onSkip,
}: {
  open: boolean;
  ownerName: string;
  onTour: () => void;
  onSkip: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2900] flex items-center justify-center bg-black/55 px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
        <div
          className="px-6 pt-7 pb-6 text-white"
          style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
        >
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/14 backdrop-blur">
            <Sparkles className="h-6 w-6 text-yellow-300" />
          </div>
          <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">
            Xush kelibsiz, {ownerName}!
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/85">
            Yozuv — Telegram orqali onlayn yozilish. Bir necha qadam va biznesingiz mijozlarni qabul qila boshlaydi.
          </p>
        </div>

        <ul className="space-y-3 px-6 py-5">
          <li className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 font-display text-sm font-extrabold text-indigo-700">
              1
            </span>
            <div>
              <div className="font-display text-sm font-bold text-ink-900">
                Xizmatlarni qo&apos;shing
              </div>
              <div className="mt-0.5 text-xs text-ink-500">
                Stomatologiya, soch olish, massaj — narx va vaqt bilan.
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 font-display text-sm font-extrabold text-indigo-700">
              2
            </span>
            <div>
              <div className="font-display text-sm font-bold text-ink-900">
                Mijozlar havolasini ulashing
              </div>
              <div className="mt-0.5 text-xs text-ink-500">
                Bot havolasini WhatsApp / Instagram / vizit kartochkasiga joylang.
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 font-display text-sm font-extrabold text-indigo-700">
              3
            </span>
            <div>
              <div className="font-display text-sm font-bold text-ink-900">
                Yozilishlarni boshqaring
              </div>
              <div className="mt-0.5 text-xs text-ink-500">
                Bron, eslatma, izohlar — hammasi bitta dashboardda.
              </div>
            </div>
          </li>
        </ul>

        <div className="flex gap-2 border-t border-ink-100 bg-ink-50 px-6 py-4">
          <button
            onClick={onSkip}
            className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-ink-700 hover:bg-ink-100"
          >
            O&apos;zim ko&apos;raman
          </button>
          <button
            onClick={onTour}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Qisqa tur
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
