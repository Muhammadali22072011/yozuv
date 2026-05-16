// Global "guided onboarding" — a sequence of page tours that take a
// brand new owner through every screen they need to know about.
//
// Flow:
//   1. New owner finishes /dashboard/onboarding (data entry wizard).
//   2. Lands on /dashboard → WelcomeModal → "Qisqa tur".
//   3. startOnboarding() flips the localStorage flag, clears any
//      previous tour-seen flags, navigates to first step's page.
//   4. Each per-page tour auto-fires (because onboarding is active).
//   5. When the user dismisses / finishes that tour, advanceOnboarding
//      moves the cursor and navigates to the next page.
//   6. After the last step, endOnboarding() flips the flag back off
//      and we land back on /dashboard.
//
// Why a separate state from tour-state.ts:
//   tour-state tracks "I've seen this once, don't pester me again".
//   onboarding tracks "user is actively in a guided sequence right
//   now and tours should fire regardless of seen state."

import { resetTours } from "./tour-state";

const ACTIVE_KEY = "yozuv_onboarding_active";
const STEP_KEY = "yozuv_onboarding_step";

export type OnboardingStep = {
  /** Tour id this step pairs with (matches the usePageTour() id). */
  tourId: string;
  /** Route the user is navigated to before this step's tour fires. */
  path: string;
  /** Short Uzbek label shown in the floating progress chip. */
  label: string;
};

// Order matters: profile first (set up the business identity), then
// services + staff + promo (the things customers actually book), then
// QR (how customers find you), then clients + bookings (read-only
// pages the owner will use day-to-day).
export const ONBOARDING_SEQUENCE: OnboardingStep[] = [
  { tourId: "profile_v1", path: "/dashboard/profile", label: "Profil" },
  { tourId: "services_v1", path: "/dashboard/services", label: "Xizmatlar" },
  { tourId: "staff_v1", path: "/dashboard/staff", label: "Mutaxassislar" },
  { tourId: "promo_v1", path: "/dashboard/promo", label: "Promo-kodlar" },
  { tourId: "qr_v1", path: "/dashboard/qr", label: "QR" },
  { tourId: "clients_v1", path: "/dashboard/clients", label: "Mijozlar" },
  { tourId: "bookings_v1", path: "/dashboard/bookings", label: "Yozilishlar" },
];

export function isOnboardingActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function getOnboardingStep(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STEP_KEY);
    const n = raw ? Number(raw) : 0;
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(ONBOARDING_SEQUENCE.length, n));
  } catch {
    return 0;
  }
}

function setStep(n: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STEP_KEY, String(n));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

/** True if the given tourId is the current step's tour. */
export function isOnboardingTour(tourId: string): boolean {
  if (!isOnboardingActive()) return false;
  const idx = getOnboardingStep();
  return ONBOARDING_SEQUENCE[idx]?.tourId === tourId;
}

/**
 * Begin (or restart) the guided onboarding sequence. Wipes any
 * previous tour-seen flags so each per-page tour fires fresh, then
 * navigates to the first step's page. Caller supplies a navigate fn
 * (router.push) so this module stays framework-agnostic.
 */
export function startOnboarding(navigate: (path: string) => void): void {
  if (typeof window === "undefined") return;
  try {
    resetTours();
    window.localStorage.setItem(ACTIVE_KEY, "1");
    setStep(0);
  } catch {
    /* ignore */
  }
  const first = ONBOARDING_SEQUENCE[0];
  if (first) navigate(first.path);
}

/**
 * Called from usePageTour's dismiss when the current step's tour
 * has just been completed. Advances the cursor; if there's a next
 * step, navigates to it; if not, ends the sequence and routes back
 * to the dashboard.
 *
 * No-op if onboarding isn't active or if the dismissed tourId
 * doesn't match the current step.
 */
export function advanceOnboarding(
  tourId: string,
  navigate: (path: string) => void
): void {
  if (!isOnboardingActive()) return;
  const idx = getOnboardingStep();
  const current = ONBOARDING_SEQUENCE[idx];
  if (!current || current.tourId !== tourId) return;

  const nextIdx = idx + 1;
  if (nextIdx >= ONBOARDING_SEQUENCE.length) {
    endOnboarding();
    navigate("/dashboard");
    return;
  }
  setStep(nextIdx);
  navigate(ONBOARDING_SEQUENCE[nextIdx].path);
}

export function endOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACTIVE_KEY);
    window.localStorage.removeItem(STEP_KEY);
  } catch {
    /* ignore */
  }
}

/** Used by the floating progress chip. */
export function getOnboardingProgress(): { current: number; total: number } | null {
  if (!isOnboardingActive()) return null;
  return {
    current: getOnboardingStep() + 1,
    total: ONBOARDING_SEQUENCE.length,
  };
}
