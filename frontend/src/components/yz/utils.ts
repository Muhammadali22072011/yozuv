export function fmtSum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("ru-RU").replace(/,/g, " ");
}

export function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function hm(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

export function durationMin(startHMS: string, endHMS: string): number {
  const [sh, sm] = startHMS.split(":").map(Number);
  const [eh, em] = endHMS.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

const MONTHS_UZ = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyn",
  "Iyl",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

const WEEKDAYS_UZ = ["Ya", "Du", "Se", "Cho", "Pa", "Ju", "Sh"];
const WEEKDAYS_UZ_LONG = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
];

export function shortDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]}`;
}

export function longDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return typeof iso === "string" ? iso : "";
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]}, ${WEEKDAYS_UZ_LONG[d.getDay()].toLowerCase()}`;
}

export function weekdayShort(d: Date): string {
  return WEEKDAYS_UZ[d.getDay()];
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function _openExternalScheme(href: string) {
  if (typeof document === "undefined") return;
  const a = document.createElement("a");
  a.href = href;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Trigger the OS phone dialer. `window.location.href = "tel:..."` is
// ignored inside the Telegram WebApp WebView; clicking an anchor with
// the same href is the path the system honours.
export function callPhone(phone: string | null | undefined) {
  if (!phone) return;
  _openExternalScheme(`tel:${phone}`);
}

// Open a Telegram chat with the client by phone number.
// Uses https://t.me/+<digits> which Telegram resolves to the chat of
// whoever owns that phone. Works because clients share their phone via
// the bot's request_contact prompt at first booking.
//
// Inside the Telegram WebApp the tg:// scheme is blocked, so we have
// to go through Telegram.WebApp.openTelegramLink(). Outside the WebApp
// (regular browser tab) we fall back to a real anchor click.
export function messageTelegram(phone: string | null | undefined) {
  if (!phone) return;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return;
  const url = `https://t.me/+${digits}`;
  if (typeof window === "undefined") return;
  type TgWebApp = { openTelegramLink?: (u: string) => void; openLink?: (u: string) => void };
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  if (tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }
  _openExternalScheme(url);
}
