"use client";

import { useMemo, useState } from "react";

/**
 * Double-sided 3D trifold brochure.
 *
 * FRONT — the business itself: Xizmatlar (services) · cover (logo + name +
 * QR) · Bogʻlanish (contacts), matching the A5 PDF.
 * BACK  — Yozuv marketing: Imkoniyatlar (features) · Tarif (pricing) ·
 * Kategoriyalar.
 *
 * Fold the wings, rotate the view, flip to the back. Styles are injected as
 * a plain <style> scoped under `.yztf` so they never depend on styled-jsx
 * and never leak into the app.
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
  --indigo-500:#5b6bff;--indigo-600:#4853f5;--indigo-700:#3640d4;
  --ink-900:#0b0f1f;--ink-700:#2a2f45;--ink-500:#5a6078;--ink-400:#848aa2;
  --ink-100:#f2f3f7;--ink-50:#f8f9fc;--cream:#f4f2ec;
  --indigo-50:#eef0ff;--indigo-100:#e0e4ff;--mint:#0e9577;--mint-bg:#e6faf3;
  --warn:#a8751a;--warn-bg:#fff3da;--coral:#c93a2a;--coral-bg:#ffe7e3;--lemon:#ffc94a;
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
.yztf .p-light{background:var(--ink-50)}
.yztf .p-cover,.yztf .p-indigo{background:linear-gradient(160deg,#5b6bff 0%,#4853f5 55%,#3640d4 100%);color:#fff}
.yztf .p-cover{align-items:center;text-align:center}
.yztf .blob{position:absolute;border-radius:50%;pointer-events:none}

/* section header */
.yztf .sec-eye{font-size:7.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .sec-title{font-weight:800;letter-spacing:-.02em;font-size:16px;color:var(--ink-900);margin-top:2px}
.yztf .sec-underline{width:26px;height:2px;border-radius:2px;background:var(--indigo-600);margin-top:6px}
.yztf .p-indigo .sec-eye{color:rgba(255,255,255,.7)}
.yztf .p-indigo .sec-title{color:#fff}

/* brand lockup */
.yztf .brandrow{display:flex;align-items:center;gap:7px}
.yztf .logo-img{width:22px;height:22px;border-radius:7px;object-fit:contain;background:#fff;flex-shrink:0;box-shadow:0 2px 6px rgba(11,15,31,.12)}
.yztf .brandname{font-weight:800;font-size:12px;letter-spacing:-.02em;color:var(--ink-900)}
.yztf .brandkk{font-size:7px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-400);line-height:1}
.yztf .p-indigo .brandname{color:#fff}
.yztf .p-indigo .brandkk{color:rgba(255,255,255,.65)}

/* services (front) */
.yztf .svc-list{margin-top:13px;display:flex;flex-direction:column;gap:9px;flex:1;overflow:hidden}
.yztf .svc-row{display:flex;align-items:baseline;gap:6px}
.yztf .svc-dot{color:var(--indigo-600);font-weight:800;font-size:11px;line-height:1}
.yztf .svc-name{font-size:11px;font-weight:700;color:var(--ink-900);letter-spacing:-.01em;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.yztf .svc-dur{font-size:8px;color:var(--ink-400);font-weight:500;white-space:nowrap}
.yztf .svc-price{font-size:10px;font-weight:800;color:var(--ink-900);white-space:nowrap}
.yztf .svc-empty{margin:auto;font-size:10px;color:var(--ink-400);font-weight:500}

/* cover (front) */
.yztf .cover-logo{width:54px;height:54px;border-radius:16px;object-fit:contain;background:#fff;margin-top:6px;box-shadow:0 10px 24px -10px rgba(11,15,31,.5)}
.yztf .cover-name{margin-top:11px;font-size:18px;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:#fff;max-width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.yztf .cover-cat{margin-top:4px;font-size:9px;font-weight:600;color:rgba(255,255,255,.78);letter-spacing:.02em}
.yztf .qr-card{margin-top:auto;background:#fff;border-radius:14px;padding:11px;width:100%;box-shadow:0 18px 40px -14px rgba(11,15,31,.5);display:flex;flex-direction:column;align-items:center;gap:7px}
.yztf .qr-card .qr{width:86px;height:86px}
.yztf .qr-card .qr svg,.yztf .qr-card .qr img{width:100%;height:100%;display:block}
.yztf .qr-cap1{font-size:8.5px;color:var(--ink-900);font-weight:700;letter-spacing:-.01em;text-align:center}
.yztf .qr-cap2{font-size:7px;color:var(--ink-500);font-family:ui-monospace,Menlo,monospace;word-break:break-all;text-align:center}

/* contacts (front) */
.yztf .ct-list{margin-top:13px;display:flex;flex-direction:column;gap:11px;flex:1}
.yztf .ct-row{display:flex;align-items:flex-start;gap:9px}
.yztf .ct-ico{width:24px;height:24px;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;box-shadow:0 2px 6px -2px rgba(11,15,31,.14)}
.yztf .ct-lab{font-size:7.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .ct-val{font-size:10px;font-weight:700;color:var(--ink-900);line-height:1.3;margin-top:1px}
.yztf .ct-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid rgba(11,15,31,.1)}
.yztf .ct-foot .link{font-size:11px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em}
.yztf .ct-foot .sub{font-size:7.5px;color:var(--ink-400);font-weight:500}

/* features (back) */
.yztf .feats{margin-top:11px;display:flex;flex-direction:column;gap:6px;flex:1}
.yztf .feat{background:#fff;border-radius:11px;padding:7px 8px;display:flex;align-items:center;gap:8px;box-shadow:0 1px 0 rgba(11,15,31,.04),0 4px 10px -6px rgba(11,15,31,.1)}
.yztf .fico{flex-shrink:0;width:21px;height:21px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px}
.yztf .ic-i{background:var(--indigo-50);color:var(--indigo-600)}
.yztf .ic-m{background:var(--mint-bg);color:var(--mint)}
.yztf .ic-l{background:var(--warn-bg);color:var(--warn)}
.yztf .ic-c{background:var(--coral-bg);color:var(--coral)}
.yztf .ic-v{background:#f0ebff;color:#6b4fe0}
.yztf .ic-s{background:#e5f4ff;color:#2a7dc2}
.yztf .fnm{font-size:10px;font-weight:800;color:var(--ink-900);letter-spacing:-.01em;line-height:1.15}
.yztf .fds{margin-top:1px;font-size:8px;color:var(--ink-500);line-height:1.3;font-weight:500}

/* pricing (back) */
.yztf .priceblk{margin-top:14px}
.yztf .price-num{font-weight:800;font-size:42px;line-height:1;color:#fff;letter-spacing:-.04em}
.yztf .price-num .per{font-size:14px;font-weight:600;color:rgba(255,255,255,.7)}
.yztf .price-note{margin-top:4px;font-size:9px;color:rgba(255,255,255,.8);font-weight:500}
.yztf .perks{margin-top:14px;display:flex;flex-direction:column;gap:7px;flex:1}
.yztf .perk{display:flex;align-items:center;gap:8px;font-size:9.5px;color:rgba(255,255,255,.92);font-weight:600}
.yztf .pchk{flex-shrink:0;width:15px;height:15px;border-radius:50%;background:rgba(255,255,255,.16);color:var(--lemon);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900}
.yztf .cta{margin-top:auto;background:#fff;border-radius:12px;padding:11px;text-align:center;box-shadow:0 14px 28px -12px rgba(11,15,31,.4)}
.yztf .cta .cl{font-size:8px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .cta .lk{margin-top:4px;font-size:12px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em}
.yztf .pop{position:absolute;top:13px;right:13px;background:var(--lemon);color:var(--ink-900);font-size:7.5px;font-weight:800;letter-spacing:.1em;padding:3px 7px;border-radius:999px;z-index:3}

/* categories (back) */
.yztf .cats{margin-top:11px;display:grid;grid-template-columns:1fr 1fr;gap:5px}
.yztf .cat{background:#fff;border-radius:9px;padding:7px;display:flex;align-items:center;gap:6px;font-size:9px;color:var(--ink-900);font-weight:700;box-shadow:0 3px 9px -6px rgba(11,15,31,.12)}
.yztf .cico{width:18px;height:18px;border-radius:6px;background:var(--indigo-50);color:var(--indigo-600);display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.yztf .quote{margin-top:auto;background:#fff;border-radius:12px;padding:11px;border-left:3px solid var(--indigo-600);box-shadow:0 6px 16px -8px rgba(11,15,31,.12)}
.yztf .qstars{color:var(--lemon);font-size:10px;letter-spacing:1px}
.yztf .quote p{margin-top:4px;font-size:10px;line-height:1.4;color:var(--ink-900);font-weight:600}
.yztf .qfoot{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:8.5px;color:var(--ink-500);font-weight:600}
.yztf .qav{width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#ffc94a,#ff7a6b);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:8px}

/* controls */
.yztf .controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center}
.yztf .ctl{display:flex;flex-direction:column;gap:5px;align-items:center}
.yztf .ctl label{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-400)}
.yztf .ctl input[type="range"]{width:120px;accent-color:var(--indigo-600);cursor:pointer}
.yztf .flipbtn{background:var(--indigo-600);color:#fff;border:none;border-radius:11px;padding:9px 16px;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:-.01em;box-shadow:0 8px 20px -8px rgba(72,83,245,.6);transition:transform .12s}
.yztf .flipbtn:hover{transform:translateY(-1px)}
.yztf .flipbtn:active{transform:translateY(0)}
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
  const [back, setBack] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [flipScale, setFlipScale] = useState(1);

  const handle = `t.me/${botUsername}?start=${slug || ""}`;
  const bizName = name || "Yozuv";
  const logoSrc = logoUrl || "/logo.png";
  const scheduleText = useMemo(() => formatSchedule(schedule), [schedule]);
  const coverQr = useMemo(() => decorativeQr(handle, 27), [handle]);

  const activeServices = (services || []).filter((s) => s.is_active !== false).slice(0, 7);

  const t = fold / 100;
  const triStyle: React.CSSProperties & Record<string, string | number> = {
    // Flip = collapse edge-on (scaleX→0), swap content, expand. No 180°
    // rotation — that would turn the panels' hidden backface to the viewer
    // and the back would render blank.
    transform: `rotateX(7deg) rotateY(${spin}deg) scaleX(${flipScale})`,
    transition: flipping ? "transform .25s ease" : "transform .15s linear",
    ["--fa"]: `${(t * 72).toFixed(2)}deg`,
    ["--sh"]: (0.08 + t * 0.5).toFixed(3),
  };

  function flip() {
    if (flipping) return;
    setFlipping(true);
    setFlipScale(0); // collapse to an edge
    window.setTimeout(() => setBack((b) => !b), 260); // swap content while collapsed
    window.setTimeout(() => setFlipScale(1), 280); // expand the new side
    window.setTimeout(() => setFlipping(false), 560);
  }

  const logoImg = (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="logo-img" src="/logo.png" alt="Yozuv" />
  );

  // ───────── FRONT (the business) ─────────
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
          {logoImg}
          <span className="link">yozuv.uz</span>
        </div>
        <span className="sub">Online yozilish</span>
      </div>
    </div>
  );

  // ───────── BACK (Yozuv marketing) ─────────
  const featuresPanel = (
    <div className="pad p-light">
      <div className="brandrow">
        {logoImg}
        <div>
          <div className="brandkk">Telegram Mini App</div>
          <div className="brandname">Yozuv</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="sec-eye">Imkoniyatlar</div>
        <div className="sec-title">Barcha vositalar</div>
      </div>
      <div className="feats">
        {[
          ["ic-i", "📅", "Aqlli yozilish", "Mijoz vaqt tanlaydi"],
          ["ic-m", "🔔", "Tasdiqlash", "Bir tugma bilan"],
          ["ic-l", "💳", "Payme / Click", "Toʻgʻridan Telegramda"],
          ["ic-s", "📊", "Analitika", "Daromad statistikasi"],
          ["ic-v", "📄", "QR-broshyura", "Avtomatik PDF"],
          ["ic-c", "🌐", "Katalog", "Mijozlar topadi"],
        ].map(([ic, emo, nm, ds]) => (
          <div className="feat" key={nm}>
            <span className={`fico ${ic}`}>{emo}</span>
            <div>
              <div className="fnm">{nm}</div>
              <div className="fds">{ds}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const pricingPanel = (
    <div className="pad p-indigo">
      <div className="pop">MASHHUR</div>
      <div className="blob" style={{ width: 150, height: 150, right: -50, top: -50, background: "rgba(255,255,255,.10)" }} />
      <div className="brandrow">
        {logoImg}
        <div>
          <div className="brandkk">Tarif</div>
          <div className="brandname">Oylik reja</div>
        </div>
      </div>
      <div className="priceblk">
        <div className="price-num">
          $15<span className="per"> / oy</span>
        </div>
        <div className="price-note">187 500 soʻm · cheksiz</div>
      </div>
      <div className="perks">
        {["Cheksiz yozilishlar", "Payme / Click toʻlov", "Analitika va eslatma", "QR va PDF broshyura", "Mijozlar bazasi"].map((p) => (
          <div className="perk" key={p}>
            <span className="pchk">✓</span>
            {p}
          </div>
        ))}
      </div>
      <div className="cta">
        <div className="cl">14 kun bepul</div>
        <div className="lk">yozuv.uz →</div>
      </div>
    </div>
  );

  const categoriesPanel = (
    <div className="pad p-light">
      <div className="brandrow">
        {logoImg}
        <div>
          <div className="brandkk">Kim uchun</div>
          <div className="brandname">Kichik biznes</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="sec-eye">Kategoriyalar</div>
        <div className="sec-title">Qaysi bizneslar?</div>
      </div>
      <div className="cats">
        {[
          ["💇", "Sartarosh"],
          ["💆", "Massaj"],
          ["🦷", "Stomatolog"],
          ["📚", "Repetitor"],
          ["📸", "Fotograf"],
          ["🏋", "Fitnes"],
          ["⚕️", "Shifokor"],
          ["📦", "Boshqa"],
        ].map(([emo, nm]) => (
          <div className="cat" key={nm}>
            <span className="cico">{emo}</span>
            {nm}
          </div>
        ))}
      </div>
      <div className="quote">
        <div className="qstars">★★★★★</div>
        <p>&quot;Har kuni 5–10 ta yozilish avtomatik keladi.&quot;</p>
        <div className="qfoot">
          <span className="qav">A</span>Akbar · Barber Akbar
        </div>
      </div>
    </div>
  );

  const panels = back
    ? [featuresPanel, pricingPanel, categoriesPanel]
    : [servicesPanel, coverPanel, contactsPanel];
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
        <button type="button" className="flipbtn" onClick={flip}>
          ↻ {back ? "Old tomon" : "Orqa tomon"}
        </button>
      </div>
    </div>
  );
}
