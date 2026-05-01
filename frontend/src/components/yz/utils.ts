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
