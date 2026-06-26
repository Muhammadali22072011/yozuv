"use client";

import { useMemo, useState } from "react";

/**
 * Simple 3D trifold brochure for one business — the same content as the A5
 * PDF, but foldable.
 *
 * Panels: Xizmatlar (services) · Cover (logo + name + QR) · Bogʻlanish (contacts).
 * Fold the wings, rotate the view. Styles are injected as a plain <style>
 * scoped under `.yztf` so they never depend on styled-jsx and never leak.
 */

const CATEGORY_LABEL_UZ: Record<string, string> = {
  barbershop: "Sartaroshxona",
  salon: "Goʻzallik saloni",
  dentist: "Stomatologiya",
  tutor: "Repetitor",
  photo: "Fotograf",
  massage: "Massaj / Spa",
  fitness: "Fitnes / Trener",
  clinic: "Shifokor / Klinika",
  other: "Biznes",
};

const DOW_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function categoryLabel(category?: string): string {
  if (!category) return "Biznes";
  return CATEGORY_LABEL_UZ[category.toLowerCase()] ?? category;
}

function formatPrice(value?: number | null): string {
  const n = Number(value || 0);
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} soʻm`;
}

type SvcLike = { name: string; price?: number | null; duration_minutes?: number | null; is_active?: boolean };
type DayLike = { day_of_week: number; start_time: string; end_time: string; is_working: boolean };

/** Compress a weekly schedule into "Du–Ju: 09:00–20:00, Sh: 10:00–18:00". */
function formatSchedule(days?: DayLike[]): string {
  if (!days || !days.length) return "";
  const byDay: Record<number, [string, string]> = {};
  for (const d of days) {
    if (!d.is_working) continue;
    const dw = d.day_of_week;
    if (dw < 0 || dw > 6) continue;
    byDay[dw] = [(d.start_time || "").slice(0, 5), (d.end_time || "").slice(0, 5)];
  }
  if (!Object.keys(byDay).length) return "";
  type G = { s: number; e: number; h: [string, string] };
  const groups: G[] = [];
  let cur: G | null = null;
  for (let d = 0; d < 7; d++) {
    const h = byDay[d];
    if (!h) {
      if (cur) {
        groups.push(cur);
        cur = null;
      }
      continue;
    }
    if (cur && cur.h[0] === h[0] && cur.h[1] === h[1] && cur.e === d - 1) cur.e = d;
    else {
      if (cur) groups.push(cur);
      cur = { s: d, e: d, h };
    }
  }
  if (cur) groups.push(cur);
  return groups
    .map((g) => `${g.s === g.e ? DOW_UZ[g.s] : `${DOW_UZ[g.s]}–${DOW_UZ[g.e]}`}: ${g.h[0]}–${g.h[1]}`)
    .join(", ");
}

/** Deterministic QR-like SVG (decorative fallback only — not scannable). */
function decorativeQr(seed: string, size = 27): string {
  const g: number[][] = [];
  for (let i = 0; i < size; i++) g.push(new Array(size).fill(0));
  let s = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    s ^= seed.charCodeAt(i);
    s = Math.imul(s, 16777619) >>> 0;
  }
  const rnd = () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return (s >>> 0) / 4294967295;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) g[y][x] = rnd() > 0.5 ? 1 : 0;
  const finder = (cx: number, cy: number) => {
    for (let y = -1; y <= 7; y++)
      for (let x = -1; x <= 7; x++) {
        const gx = cx + x;
        const gy = cy + y;
        if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue;
        if (x === -1 || y === -1 || x === 7 || y === 7) {
          g[gy][gx] = 0;
          continue;
        }
        let v = 0;
        if (x === 0 || x === 6 || y === 0 || y === 6) v = 1;
        else if (x >= 2 && x <= 4 && y >= 2 && y <= 4) v = 1;
        g[gy][gx] = v;
      }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    g[6][i] = i % 2 === 0 ? 1 : 0;
    g[i][6] = i % 2 === 0 ? 1 : 0;
  }
  const cell = 100 / size;
  let rects = "";
  for (let y = 0; y < size; y++) {
    let rs = -1;
    for (let x = 0; x <= size; x++) {
      const v = x < size ? g[y][x] : 0;
      if (v && rs < 0) rs = x;
      if ((!v || x === size) && rs >= 0) {
        rects += `<rect x="${(rs * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${((x - rs) * cell).toFixed(2)}" height="${cell.toFixed(2)}"/>`;
        rs = -1;
      }
    }
  }
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges"><rect width="100" height="100" fill="#fff"/><g fill="#0B0F1F">${rects}</g></svg>`;
}

const CSS = `
.yztf{
  --indigo-600:#4853f5;--indigo-700:#3640d4;
  --ink-900:#0b0f1f;--ink-700:#2a2f45;--ink-500:#5a6078;--ink-400:#848aa2;
  --ink-100:#f2f3f7;--cream:#f4f2ec;--lemon:#ffc94a;
  display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;
  font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,system-ui,sans-serif;
}
.yztf .stage{width:100%;height:400px;perspective:1700px;perspective-origin:50% 42%;
  display:flex;align-items:center;justify-content:center;position:relative}
.yztf .tri{transform-style:preserve-3d;display:flex;will-change:transform}
.yztf .floor{position:absolute;left:50%;bottom:40px;width:360px;height:56px;transform:translateX(-50%);
  background:radial-gradient(ellipse at center,rgba(11,15,31,.18),transparent 70%);filter:blur(6px);z-index:-1;pointer-events:none}
.yztf .panel{position:relative;width:168px;height:326px;flex:0 0 auto;overflow:hidden;backface-visibility:hidden;border-radius:2px}
.yztf .panel.left{transform-origin:right center;transform:rotateY(var(--fa,46deg));border-right:1px solid rgba(11,15,31,.1)}
.yztf .panel.right{transform-origin:left center;transform:rotateY(calc(var(--fa,46deg) * -1));border-left:1px solid rgba(11,15,31,.1)}
.yztf .panel.center{transform:translateZ(.1px)}
.yztf .panel::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .15s linear}
.yztf .panel.left::after{background:linear-gradient(90deg,rgba(11,15,31,.42),transparent 60%);opacity:var(--sh,.4)}
.yztf .panel.right::after{background:linear-gradient(270deg,rgba(11,15,31,.42),transparent 60%);opacity:var(--sh,.4)}
.yztf .pad{padding:14px 13px;height:100%;display:flex;flex-direction:column;position:relative;z-index:1}
.yztf .p-svc{background:#fff}
.yztf .p-ct{background:var(--cream)}
.yztf .p-cover{background:linear-gradient(160deg,#5b6bff 0%,#4853f5 55%,#3640d4 100%);color:#fff;align-items:center;text-align:center}
.yztf .blob{position:absolute;border-radius:50%;pointer-events:none}

/* section header */
.yztf .sec-eye{font-size:7.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .sec-title{font-weight:800;letter-spacing:-.02em;font-size:16px;color:var(--ink-900);margin-top:2px}
.yztf .sec-underline{width:26px;height:2px;border-radius:2px;background:var(--indigo-600);margin-top:6px}

/* logo lockup */
.yztf .brandrow{display:flex;align-items:center;gap:7px}
.yztf .logo-img{width:22px;height:22px;border-radius:7px;object-fit:contain;background:#fff;flex-shrink:0;box-shadow:0 2px 6px rgba(11,15,31,.12)}
.yztf .brandname{font-weight:800;font-size:12px;letter-spacing:-.02em;color:var(--ink-900)}

/* services */
.yztf .svc-list{margin-top:13px;display:flex;flex-direction:column;gap:9px;flex:1;overflow:hidden}
.yztf .svc-row{display:flex;align-items:baseline;gap:6px}
.yztf .svc-dot{color:var(--indigo-600);font-weight:800;font-size:11px;line-height:1}
.yztf .svc-name{font-size:11px;font-weight:700;color:var(--ink-900);letter-spacing:-.01em;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.yztf .svc-dur{font-size:8px;color:var(--ink-400);font-weight:500;white-space:nowrap}
.yztf .svc-price{font-size:10px;font-weight:800;color:var(--ink-900);white-space:nowrap}
.yztf .svc-empty{margin:auto;font-size:10px;color:var(--ink-400);font-weight:500}

/* cover */
.yztf .cover-logo{width:54px;height:54px;border-radius:16px;object-fit:contain;background:#fff;margin-top:6px;
  box-shadow:0 10px 24px -10px rgba(11,15,31,.5)}
.yztf .cover-name{margin-top:11px;font-size:18px;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:#fff;
  max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.yztf .cover-cat{margin-top:4px;font-size:9px;font-weight:600;color:rgba(255,255,255,.78);letter-spacing:.02em}
.yztf .qr-card{margin-top:auto;background:#fff;border-radius:14px;padding:11px;width:100%;
  box-shadow:0 18px 40px -14px rgba(11,15,31,.5);display:flex;flex-direction:column;align-items:center;gap:7px}
.yztf .qr-card .qr{width:86px;height:86px}
.yztf .qr-card .qr svg,.yztf .qr-card .qr img{width:100%;height:100%;display:block}
.yztf .qr-cap1{font-size:8.5px;color:var(--ink-900);font-weight:700;letter-spacing:-.01em;text-align:center}
.yztf .qr-cap2{font-size:7px;color:var(--ink-500);font-family:ui-monospace,Menlo,monospace;word-break:break-all;text-align:center}

/* contacts */
.yztf .ct-list{margin-top:13px;display:flex;flex-direction:column;gap:11px;flex:1}
.yztf .ct-row{display:flex;align-items:flex-start;gap:9px}
.yztf .ct-ico{width:24px;height:24px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;
  font-size:12px;flex-shrink:0;box-shadow:0 2px 6px -2px rgba(11,15,31,.14)}
.yztf .ct-lab{font-size:7.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .ct-val{font-size:10px;font-weight:700;color:var(--ink-900);line-height:1.3;margin-top:1px}
.yztf .ct-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:10px;
  border-top:1px solid rgba(11,15,31,.1)}
.yztf .ct-foot .link{font-size:11px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em}
.yztf .ct-foot .sub{font-size:7.5px;color:var(--ink-400);font-weight:500}

/* controls */
.yztf .controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center}
.yztf .ctl{display:flex;flex-direction:column;gap:5px;align-items:center}
.yztf .ctl label{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-400)}
.yztf .ctl input[type="range"]{width:130px;accent-color:var(--indigo-600);cursor:pointer}
@media (max-width:420px){.yztf .stage{height:340px;transform:scale(.82)}}
`;

type Props = {
  name?: string;
  slug?: string;
  category?: string;
  botUsername?: string;
  qrUrl?: string | null;
  /** Business logo; falls back to the Yozuv mark. */
  logoUrl?: string | null;
  services?: SvcLike[];
  address?: string;
  phone?: string;
  schedule?: DayLike[];
};

export default function BrochureTrifold3D({
  name,
  slug,
  category,
  botUsername = "Yozuv_cl_bot",
  qrUrl,
  logoUrl,
  services,
  address,
  phone,
  schedule,
}: Props) {
  const [fold, setFold] = useState(40);
  const [spin, setSpin] = useState(-14);

  const handle = `t.me/${botUsername}?start=${slug || ""}`;
  const bizName = name || "Yozuv";
  const logoSrc = logoUrl || "/logo.png";
  const scheduleText = useMemo(() => formatSchedule(schedule), [schedule]);
  const coverQr = useMemo(() => decorativeQr(handle, 27), [handle]);

  const activeServices = (services || []).filter((s) => s.is_active !== false).slice(0, 7);

  const t = fold / 100;
  const triStyle: React.CSSProperties & Record<string, string | number> = {
    transform: `rotateX(7deg) rotateY(${spin}deg)`,
    transition: "transform .15s linear",
    ["--fa"]: `${(t * 72).toFixed(2)}deg`,
    ["--sh"]: (0.08 + t * 0.5).toFixed(3),
  };

  const servicesPanel = (
    <div className="pad p-svc">
      <div className="sec-eye">Narxlar</div>
      <div className="sec-title">Xizmatlar</div>
      <div className="sec-underline" />
      {activeServices.length ? (
        <div className="svc-list">
          {activeServices.map((s, i) => (
            <div className="svc-row" key={i}>
              <span className="svc-dot">•</span>
              <span className="svc-name">{s.name}</span>
              {s.duration_minutes ? <span className="svc-dur">{s.duration_minutes} daq</span> : null}
              <span className="svc-price">{formatPrice(s.price)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="svc-empty">Xizmatlar tez orada</div>
      )}
    </div>
  );

  const coverPanel = (
    <div className="pad p-cover">
      <div className="blob" style={{ width: 150, height: 150, right: -50, top: -40, background: "rgba(255,255,255,.10)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="cover-logo"
        src={logoSrc}
        alt={bizName}
        onError={(e) => {
          const img = e.currentTarget;
          if (!img.src.endsWith("/logo.png")) img.src = "/logo.png";
        }}
      />
      <div className="cover-name">{bizName}</div>
      <div className="cover-cat">{categoryLabel(category)}</div>
      <div className="qr-card">
        <div className="qr">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="QR" />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: coverQr }} />
          )}
        </div>
        <div className="qr-cap1">Skaner qiling va yoziling</div>
        <div className="qr-cap2">{handle}</div>
      </div>
    </div>
  );

  const contactsPanel = (
    <div className="pad p-ct">
      <div className="sec-eye">Bogʻlanish</div>
      <div className="sec-title">Kontakt</div>
      <div className="sec-underline" />
      <div className="ct-list">
        {address ? (
          <div className="ct-row">
            <span className="ct-ico">📍</span>
            <div>
              <div className="ct-lab">Manzil</div>
              <div className="ct-val">{address}</div>
            </div>
          </div>
        ) : null}
        {phone ? (
          <div className="ct-row">
            <span className="ct-ico">📞</span>
            <div>
              <div className="ct-lab">Telefon</div>
              <div className="ct-val">{phone}</div>
            </div>
          </div>
        ) : null}
        {scheduleText ? (
          <div className="ct-row">
            <span className="ct-ico">🕐</span>
            <div>
              <div className="ct-lab">Ish vaqti</div>
              <div className="ct-val">{scheduleText}</div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="ct-foot">
        <div className="brandrow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo-img" src="/logo.png" alt="Yozuv" />
          <span className="link">yozuv.uz</span>
        </div>
        <span className="sub">Online yozilish</span>
      </div>
    </div>
  );

  const panels = [servicesPanel, coverPanel, contactsPanel];
  const cls = ["left", "center", "right"];

  return (
    <div className="yztf">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="stage">
        <div className="tri" style={triStyle}>
          {panels.map((p, i) => (
            <div className={`panel ${cls[i]}`} key={cls[i]}>
              {p}
            </div>
          ))}
        </div>
        <div className="floor" />
      </div>

      <div className="controls">
        <div className="ctl">
          <label>Burama</label>
          <input type="range" min={0} max={100} value={fold} onChange={(e) => setFold(+e.target.value)} />
        </div>
        <div className="ctl">
          <label>Koʻrinish</label>
          <input type="range" min={-45} max={45} value={spin} onChange={(e) => setSpin(+e.target.value)} />
        </div>
      </div>
    </div>
  );
}
