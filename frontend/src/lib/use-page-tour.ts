"use client";

// Tiny hook that wires the spotlight Tour component into any page
// with three lines of code:
//
//   const tour = usePageTour("services_v1", [...]);
//   ...
//   <TourFloat tour={tour} />
//
// Behaviour:
// * Auto-opens the first time the page mounts (per browser, gated by
//   the localStorage flag set in lib/tour-state).
// * Also auto-opens regardless of the seen flag when the user is in
//   the global guided onboarding sequence AND the current onboarding
//   step matches this tour id. That's how the chain ("after profile,
//   go to services, then staff, ...") survives across page nav.
// * Defers the open by ~400ms so the page's data fetches and DOM
//   anchors land before the spotlight tries to measure them.
// * On dismiss, if onboarding is active, advances to the next step
//   and routes the user to that page.
// * Returns a `replay()` callback so the floating "?" button can
//   re-open the tour for users who skipped.
//
// Bumping the version suffix (e.g. "services_v1" -> "services_v2")
// re-shows the tour to everyone after a major UI redesign.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { TourStep } from "@/components/yz/Tour";
import { hasSeenTour, markTourSeen } from "@/lib/tour-state";
import {
  advanceOnboarding,
  isOnboardingActive,
  isOnboardingTour,
} from "@/lib/onboarding";

const OPEN_DELAY_MS = 400;

export function usePageTour(tourId: string, steps: TourStep[]) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // Holds the deferred advanceOnboarding timer scheduled in dismiss().
  // Captured so it can be cleared on unmount (and before re-scheduling),
  // otherwise it could fire after the component is gone — e.g. the user
  // X-quits the guided sequence inside the 250ms window.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (advanceTimer.current !== null) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // During guided onboarding the tour ALWAYS fires when the user
    // lands on the step's page, even if they "saw" this tour before
    // — that's the whole point of the replay-from-Settings affordance.
    const isThisStep = isOnboardingTour(tourId);
    if (!isThisStep && hasSeenTour(tourId)) return;
    const t = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(t);
    // tourId is the only real dependency — steps is a fresh array
    // every render, including it would cause an immediate re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId]);

  function dismiss() {
    markTourSeen(tourId);
    setOpen(false);
    // If the user is in the guided sequence and this is the current
    // step, push them to the next page. Defer a tick so the tour's
    // own close animation finishes before the route change.
    if (isOnboardingActive() && isOnboardingTour(tourId)) {
      if (advanceTimer.current !== null) {
        clearTimeout(advanceTimer.current);
      }
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        advanceOnboarding(tourId, (p) => router.push(p));
      }, 250);
    }
  }

  function replay() {
    setOpen(true);
  }

  return { open, steps, dismiss, replay };
}
