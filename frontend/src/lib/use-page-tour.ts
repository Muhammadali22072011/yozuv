"use client";

// Tiny hook that wires the spotlight Tour component into any page
// with three lines of code:
//
//   const tour = usePageTour("services_v1", [...]);
//   ...
//   <Tour open={tour.open} steps={tour.steps} onClose={tour.dismiss} />
//
// Behaviour:
// * Auto-opens the first time the page mounts (per browser, gated by
//   the localStorage flag set in lib/tour-state).
// * Defers the open by ~400ms so the page's data fetches and DOM
//   anchors land before the spotlight tries to measure them.
// * Returns a `replay()` callback so a future "?" button can re-open
//   the tour for users who skipped.
//
// Bumping the version suffix (e.g. "services_v1" -> "services_v2")
// re-shows the tour to everyone after a major UI redesign.

import { useEffect, useState } from "react";
import type { TourStep } from "@/components/yz/Tour";
import { hasSeenTour, markTourSeen } from "@/lib/tour-state";

const OPEN_DELAY_MS = 400;

export function usePageTour(tourId: string, steps: TourStep[]) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (hasSeenTour(tourId)) return;
    const t = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(t);
    // tourId is the only real dependency — steps is a fresh array
    // every render, including it would cause an immediate re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  function dismiss() {
    markTourSeen(tourId);
    setOpen(false);
  }

  function replay() {
    setOpen(true);
  }

  return { open, steps, dismiss, replay };
}
