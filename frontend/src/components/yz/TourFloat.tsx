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
          className="fixed left-1/2 top-4 z-[3100] -translate-x-1/2 transform"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-full bg-indigo-600 px-3 py-1.5 text-white shadow-[0_10px_30px_rgba(72,83,245,0.35)]">
            <span className="font-display text-[11px] font-extrabold tracking-wide">
              {progress.current}/{progress.total}
            </span>
            <span className="text-[12px] font-semibold opacity-90">·</span>
            <span className="font-display text-[12px] font-bold">{stepLabel}</span>
            <button
              onClick={quitOnboarding}
              aria-label="Onboardingni o'tkazib yuborish"
              className="ml-1 grid h-5 w-5 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X className="h-3 w-3" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      )}

      {!tour.open && (
        <button
          onClick={tour.replay}
          aria-label="Qo'llanmani qayta ko'rish"
          title="Qo'llanmani qayta ko'rish"
          className="fixed bottom-24 right-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-white text-indigo-600 shadow-[0_10px_30px_rgba(72,83,245,0.22)] ring-1 ring-indigo-100 tap md:bottom-6"
        >
          <HelpCircle className="h-5 w-5" strokeWidth={2.2} />
        </button>
      )}
    </>
  );
}
