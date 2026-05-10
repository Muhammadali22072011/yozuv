// Tutorial / onboarding tour state.
//
// Each tour has a string id; we mark it "seen" in localStorage so a
// returning user doesn't get re-onboarded after every login. There's no
// server-side persistence — localStorage is per-device, but that's
// fine: a tutorial isn't worth a DB column, and a user who switches
// devices arguably benefits from re-seeing the tour on the new one.

const KEY = "yozuv_tour_seen";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Quota exceeded / private mode — silently noop.
  }
}

export function hasSeenTour(id: string): boolean {
  return Boolean(readMap()[id]);
}

export function markTourSeen(id: string): void {
  const m = readMap();
  m[id] = Date.now();
  writeMap(m);
}

export function resetTours(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
