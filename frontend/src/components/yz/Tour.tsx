"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { ArrowRight, MousePointerClick, X } from "lucide-react";

/**
 * Interactive spotlight tour.
 *
 * Each step has one of two modes:
 *
 *   "info"   — read-only context. Tooltip with a Next button; click
 *              to advance. Default mode.
 *
 *   "action" — wait for the user to actually CLICK the highlighted
 *              element. No Next button. A pulsing pointer hovers over
 *              the target so the user can't miss what to press. The
 *              click goes through normally (the dim layer leaves the
 *              spotlight area clickable) AND the tour advances.
 */

export type TourStep = {
  targetSelector: string;
  title: string;
  body: string;
  /** Default "info". "action" makes the user click the target to advance. */
  mode?: "info" | "action";
};

const PAD = 8;
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

  useEffect(() => {
    if (open) setIdx(0);
  }, [open]);

  const step = steps[idx];

  useLayoutEffect(() => {
    if (!open || !step) return;
    const measure = () => {
      const el = document.querySelector(step.targetSelector) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center" });
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

  // Action mode: listen for clicks anywhere; if the click landed
  // inside the target subtree, advance the tour. Capture phase so we
  // see the click even if the target stops propagation. Defer 50ms
  // so the target's own handler runs first.
  useEffect(() => {
    if (!open || !step) return;
    if ((step.mode || "info") !== "action") return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest(step.targetSelector)) return;
      setTimeout(() => {
        if (idx + 1 < steps.length) setIdx(idx + 1);
        else onClose();
      }, 50);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [open, idx, step, steps.length, onClose]);

  if (!open || !step) return null;

  if (rect === null) {
    queueMicrotask(() => {
      if (idx + 1 < steps.length) setIdx(idx + 1);
      else onClose();
    });
    return null;
  }

  const mode = step.mode || "info";
  const isLast = idx === steps.length - 1;
  const tooltipBelow = rect.top < vh / 2;
  const tipTop = tooltipBelow ? rect.bottom + 24 : rect.top - 16;
  const tipLeftRaw = rect.left + rect.width / 2 - TIP_W / 2;
  const tipLeft = Math.max(12, Math.min(vw - TIP_W - 12, tipLeftRaw));

  const halo = {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };

  const pointerLeft = rect.left + rect.width / 2 - 16;
  const pointerTop = rect.top + rect.height / 2 - 16;

  return (
    <div className="fixed inset-0 z-[3000]" aria-live="polite">
      <div
        className="absolute inset-x-0 top-0 bg-black/60 transition-all"
        style={{ height: Math.max(0, halo.top) }}
      />
      <div
        className="absolute bottom-0 inset-x-0 bg-black/60 transition-all"
        style={{ top: halo.top + halo.height }}
      />
      <div
        className="absolute bg-black/60 transition-all"
        style={{
          top: halo.top,
          height: halo.height,
          left: 0,
          width: Math.max(0, halo.left),
        }}
      />
      <div
        className="absolute bg-black/60 transition-all"
        style={{
          top: halo.top,
          height: halo.height,
          left: halo.left + halo.width,
          right: 0,
        }}
      />

      <div
        className={`pointer-events-none absolute rounded-3xl ring-2 ring-indigo-400/90 ring-offset-2 ring-offset-transparent ${
          mode === "action" ? "yz-tour-pulse" : ""
        }`}
        style={{
          top: halo.top,
          left: halo.left,
          width: halo.width,
          height: halo.height,
        }}
      />

      {mode === "action" && (
        <div
          className="pointer-events-none absolute z-[3001] grid h-8 w-8 place-items-center rounded-full bg-indigo-600 text-white shadow-[0_8px_24px_rgba(72,83,245,0.55)] yz-tour-bounce"
          style={{ top: pointerTop, left: pointerLeft }}
          aria-hidden
        >
          <MousePointerClick className="h-4 w-4" />
        </div>
      )}

      <div
        className="absolute rounded-3xl bg-white p-5 shadow-[0_24px_60px_-12px_rgba(11,15,31,0.35),0_8px_24px_-8px_rgba(72,83,245,0.18)] ring-1 ring-black/5 animate-card-in"
        style={{
          top: tipTop,
          transform: tooltipBelow ? "translateY(0)" : "translateY(-100%)",
          left: tipLeft,
          width: TIP_W,
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="eyebrow tnum text-indigo-500">
                {idx + 1} / {steps.length}
              </span>
              {mode === "action" && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-indigo-700">
                  BOSING
                </span>
              )}
            </div>
            <div className="mt-1.5 font-display text-base font-extrabold tracking-tight text-ink-900">
              {step.title}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Yopish"
            className="tap grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-ink-400 hover:bg-ink-100 hover:text-ink-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-600">{step.body}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-1 text-xs font-semibold text-ink-400 transition-colors hover:text-ink-600"
          >
            O&apos;tkazib yuborish
          </button>
          {mode === "info" ? (
            <button
              onClick={() => {
                if (isLast) onClose();
                else setIdx(idx + 1);
              }}
              className="tap inline-flex items-center gap-1.5 rounded-2xl px-4 py-2.5 font-display text-xs font-bold text-white"
              style={{
                background: "linear-gradient(180deg, #5b6bff 0%, #4853f5 100%)",
                boxShadow:
                  "0 10px 22px -10px rgba(72,83,245,0.55), inset 0 1px 0 rgba(255,255,255,0.22)",
              }}
            >
              {isLast ? "Tayyor" : "Keyingisi"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-50 px-4 py-2.5 font-display text-xs font-bold text-indigo-700">
              <MousePointerClick className="h-3.5 w-3.5" />
              Yorqin tugmani bosing
            </span>
          )}
        </div>
      </div>

      <style jsx>{`
        :global(.yz-tour-pulse) {
          animation: yz-tour-pulse 1.4s ease-in-out infinite;
        }
        @keyframes yz-tour-pulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(72, 83, 245, 0.5);
          }
          50% {
            box-shadow: 0 0 0 12px rgba(72, 83, 245, 0);
          }
        }
        :global(.yz-tour-bounce) {
          animation: yz-tour-bounce 1s ease-in-out infinite;
        }
        @keyframes yz-tour-bounce {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
}
