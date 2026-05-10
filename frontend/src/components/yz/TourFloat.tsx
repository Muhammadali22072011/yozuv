"use client";

// One-line tour mount point with a built-in "Replay" launcher.
//
// Pages call usePageTour(...) and render <TourFloat tour={tour} />.
// This component:
//   - Renders the spotlight Tour (open/dismiss flow).
//   - Renders a small floating "?" pill in the bottom-right when the
//     tour is closed, so the user can always re-watch the lesson.
//
// Sits above the mobile bottom tab bar (bottom-24) so it never collides.

import { HelpCircle } from "lucide-react";
import { Tour } from "./Tour";
import type { TourStep } from "./Tour";

type PageTour = {
  open: boolean;
  steps: TourStep[];
  dismiss: () => void;
  replay: () => void;
};

export function TourFloat({ tour }: { tour: PageTour }) {
  return (
    <>
      <Tour open={tour.open} steps={tour.steps} onClose={tour.dismiss} />
      {!tour.open && (
        <button
          onClick={tour.replay}
          aria-label="Obuchenie qaytadan ko'rish"
          title="Obuchenie qaytadan ko'rish"
          className="fixed bottom-24 right-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-white text-indigo-600 shadow-[0_10px_30px_rgba(72,83,245,0.22)] ring-1 ring-indigo-100 tap md:bottom-6"
        >
          <HelpCircle className="h-5 w-5" strokeWidth={2.2} />
        </button>
      )}
    </>
  );
}
