"use client";

// One-line tour mount point with a built-in "Replay" launcher and a
// guided-onboarding progress chip.
//
// Pages call usePageTour(...) and render <TourFloat tour={tour} />.
// This component:
//   - Renders the spotlight Tour (open/dismiss flow).
//   - Renders a small floating "?" pill in the bottom-right when the
//     tour is closed, so the user can always re-watch the lesson.
//   - When the user is in a guided multi-page onboarding sequence,
//     also renders a small chip at the top: "3/7 · Mutaxassislar"
//     plus an X to bail out of the whole sequence.
//
// All floating elements sit above the mobile bottom tab bar
// (bottom-24) so they never collide.

import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Tour } from "./Tour";
import type { TourStep } from "./Tour";
import {
  ONBOARDING_SEQUENCE,
  endOnboarding,
  getOnboardingProgress,
  isOnboardingActive,
} from "@/lib/onboarding";

type PageTour = {
  open: boolean;
  steps: TourStep[];
  dismiss: () => void;
  replay: () => void;
};

export function TourFloat({ tour }: { tour: PageTour }) {
  const router = useRouter();
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  // Onboarding state lives in localStorage; re-read it on mount and
  // every time the tour open/close state changes (since dismiss may
  // have just advanced the cursor).
  useEffect(() => {
    setProgress(getOnboardingProgress());
  }, [tour.open]);

  const stepLabel = (() => {
    if (!progress) return "";
    const step = ONBOARDING_SEQUENCE[progress.current - 1];
    return step?.label ?? "";
  })();

  function quitOnboarding() {
    endOnboarding();
    setProgress(null);
    router.push("/dashboard");
  }

  return (
    <>
      <Tour open={tour.open} steps={tour.steps} onClose={tour.dismiss} />

      {/* Onboarding progress chip — only when actively in the sequence. */}
      {progress && isOnboardingActive() && (
        <div
          className="fixed left-1/2 top-4 z-30 -translate-x-1/2 transform px-3"
          style={{ top: "max(1rem, env(safe-area-inset-top))" }}
          aria-live="polite"
        >
          <div className="animate-card-in flex items-center gap-2 rounded-full bg-white/90 py-1.5 pl-1.5 pr-2 shadow-soft ring-1 ring-ink-100 backdrop-blur">
            <span className="yz-feature tnum grid place-items-center rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold tracking-wide text-white">
              {progress.current}/{progress.total}
            </span>
            <span className="font-display text-[12px] font-bold text-ink-900">
              {stepLabel}
            </span>
            <button
              onClick={quitOnboarding}
              aria-label="Onboardingni o'tkazib yuborish"
              className="tap grid h-5 w-5 place-items-center rounded-full bg-ink-100 text-ink-500 hover:bg-ink-200 hover:text-ink-700"
            >
              <X className="h-3 w-3" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {!tour.open && (
        <button
          onClick={tour.replay}
          aria-label="Obuchenie qaytadan ko'rish"
          title="Obuchenie qaytadan ko'rish"
          className="tap fixed bottom-24 right-4 z-30 grid h-12 w-12 place-items-center rounded-2xl bg-white text-indigo-600 shadow-soft-lg ring-1 ring-ink-100 transition-colors hover:bg-indigo-50 active:scale-[0.94] md:bottom-6"
        >
          <HelpCircle className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </button>
      )}
    </>
  );
}
