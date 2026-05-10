"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowRight, X } from "lucide-react";

/**
 * Spotlight tour component.
 *
 * Walks the user through a sequence of UI anchors. Each step has a
 * `targetSelector` (CSS selector — typically `[data-tour-id="x"]`),
 * a title and a body. We render a dimming overlay with a hole punched
 * out around the target via two clip-path rectangles, plus a tooltip
 * card placed above or below the target depending on viewport room.
 *
 * "Next" advances; "Skip" closes the whole tour. Both call onClose()
 * when the run ends so the caller can persist "user has seen this".
 *
 * If a step's target isn't on the page (route changed, conditional
 * rendering), we skip it gracefully rather than show an empty halo.
 */

export type TourStep = {
  targetSelector: string;
  title: string;
  body: string;
};

const PAD = 8; // halo padding around the target
const TIP_W = 320;

export function Tour({
  steps,
  open,
  onClose,
}: {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);

  // Reset when the tour re-opens so re-running starts at step 0.
  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  const step = steps[idx];

  // Find the target and resize its bounding box on every step / on
  // window resize. useLayoutEffect to avoid a one-frame flash where
  // the spotlight is at the wrong position.
  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      // Bring the target into view first — otherwise a tour step
      // anchored to something below the fold is invisible behind the
      // dimming overlay.
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Wait one frame for the smooth scroll to update bounds.
      requestAnimationFrame(() => {
        setRect(el.getBoundingClientRect());
        setVw(window.innerWidth);
        setVh(window.innerHeight);
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, idx, step]);

  if (!open || !step) return null;

  // Auto-advance past missing targets so a stale selector doesn't
  // strand the user. If we run out of steps we just close.
  if (rect === null) {
    queueMicrotask(() => {
      if (idx + 1 < steps.length) setIdx(idx + 1);
      else onClose();
    });
    return null;
  }

  const isLast = idx === steps.length - 1;
  const tooltipBelow = rect.top < vh / 2;
  const tipTop = tooltipBelow ? rect.bottom + 16 : rect.top - 16;
  // Center the tooltip horizontally over the target but clamp inside
  // the viewport so it doesn't stick off the edge on mobile.
  const tipLeftRaw = rect.left + rect.width / 2 - TIP_W / 2;
  const tipLeft = Math.max(12, Math.min(vw - TIP_W - 12, tipLeftRaw));

  // Halo coordinates for the spotlight clip path.
  const halo = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  return (
    <div className="fixed inset-0 z-[3000]" aria-live="polite">
      {/* Dimming overlay with a transparent rectangle over the target.
          We use four absolutely-positioned divs instead of clip-path
          so iOS Telegram WebView (which has shaky clip-path support)
          still gets a proper spotlight. */}
      <div
        className="absolute inset-x-0 top-0 bg-black/55 transition-all"
        style={{ height: Math.max(0, halo.top) }}
      />
      <div
        className="absolute bottom-0 inset-x-0 bg-black/55 transition-all"
        style={{ top: halo.top + halo.height }}
      />
      <div
        className="absolute bg-black/55 transition-all"
        style={{
          top: halo.top,
          height: halo.height,
          left: 0,
          width: Math.max(0, halo.left),
        }}
      />
      <div
        className="absolute bg-black/55 transition-all"
        style={{
          top: halo.top,
          height: halo.height,
          left: halo.left + halo.width,
          right: 0,
        }}
      />
      {/* Halo border so the target is visually framed. */}
      <div
        className="pointer-events-none absolute rounded-2xl ring-2 ring-indigo-400 ring-offset-2 ring-offset-transparent"
        style={{
          top: halo.top,
          left: halo.left,
          width: halo.width,
          height: halo.height,
        }}
      />

      {/* Tooltip card */}
      <div
        className="absolute rounded-2xl bg-white p-4 shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
        style={{
          top: tooltipBelow ? tipTop : tipTop,
          transform: tooltipBelow ? "translateY(0)" : "translateY(-100%)",
          left: tipLeft,
          width: TIP_W,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
              {idx + 1} / {steps.length}
            </div>
            <div className="mt-1 font-display text-base font-extrabold text-ink-900">
              {step.title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-ink-400 hover:bg-ink-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-ink-400 hover:text-ink-600"
          >
            O&apos;tkazib yuborish
          </button>
          <button
            onClick={() => {
              if (isLast) onClose();
              else setIdx(idx + 1);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            {isLast ? "Tayyor" : "Keyingisi"}
            {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
