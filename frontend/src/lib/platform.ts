// Single source of truth for "where is the app running": inside the
// Telegram Mini App (WebApp with signed initData) or a plain browser.
// Auth and UI branch on this instead of scattering window.Telegram checks.

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: unknown;
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        version?: string;
        platform?: string;
      };
    };
    // Injected by the Capacitor runtime inside the Android/iOS app shell.
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  }
}

export type Platform = "telegram" | "native" | "browser";

/**
 * True only when we're inside Telegram WebApp AND it handed us non-empty
 * initData — i.e. we can authenticate via the Telegram path. A Telegram
 * link opened in a normal browser has the script but no initData, so it
 * is treated as a browser (password path).
 */
export function isTelegramMiniApp(): boolean {
  if (typeof window === "undefined") return false;
  const initData = window.Telegram?.WebApp?.initData;
  return typeof initData === "string" && initData.length > 0;
}

/**
 * The start_param handed to a Mini App opened via a deep link such as
 * `t.me/<bot>?startapp=ref_<CODE>`. Telegram surfaces it on initDataUnsafe.
 * Returns null in a plain browser or when no param was passed.
 */
export function getStartParam(): string | null {
  if (typeof window === "undefined") return null;
  const u = window.Telegram?.WebApp?.initDataUnsafe as
    | { start_param?: string }
    | undefined;
  return u?.start_param ?? null;
}

/** Running inside the Capacitor native shell (Android/iOS APK). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = window.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") return cap.isNativePlatform();
  // Older Capacitor: presence of getPlatform() returning a native value.
  return cap.getPlatform?.() === "android" || cap.getPlatform?.() === "ios";
}

/**
 * The three runtime environments, in priority order. Telegram wins (signed
 * initData beats everything); then the native APK; otherwise a plain browser.
 */
export function getPlatform(): Platform {
  if (isTelegramMiniApp()) return "telegram";
  if (isNativeApp()) return "native";
  return "browser";
}

/** Plain web browser (not Telegram, not the native shell) — password path. */
export function isBrowser(): boolean {
  return getPlatform() === "browser";
}

export {};
