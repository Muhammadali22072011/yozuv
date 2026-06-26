"use client";

import { useMemo, useState } from "react";

/**
 * Interactive 3D trifold brochure for Yozuv.
 *
 * Front (3 panels): Imkoniyatlar · Qanday ishlaydi · Cover (business + QR).
 * Back  (3 panels): Tarif · Kategoriyalar · Bogʻlanish.
 *
 * Pure CSS 3D — fold the wings, rotate the view, flip to the back.
 * Styles are injected as a plain <style> scoped under the `.yztf` root so
 * they never depend on styled-jsx transforms and never leak into the app.
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

function categoryLabel(category?: string): string {
  if (!category) return "Biznes";
  return CATEGORY_LABEL_UZ[category.toLowerCase()] ?? category;
}

/** Deterministic QR-like SVG (decorative preview only — not scannable). */
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
  --ink-900:#0b0f1f;--ink-500:#5a6078;--ink-400:#848aa2;--ink-50:#f8f9fc;
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
.yztf .pad{padding:13px 12px;height:100%;display:flex;flex-direction:column;position:relative;z-index:1}
.yztf .p-light{background:var(--ink-50)}
.yztf .p-white{background:#fff}
.yztf .p-hero,.yztf .p-indigo{background:linear-gradient(160deg,#5b6bff 0%,#4853f5 55%,#3640d4 100%);color:#fff}
.yztf .p-dark{background:linear-gradient(135deg,#0b0f1f 0%,#1e2270 100%);color:#fff}
.yztf .blob{position:absolute;border-radius:50%;pointer-events:none}
.yztf .head{margin-top:12px}
.yztf .logo{display:flex;align-items:center;gap:7px;position:relative;z-index:1}
.yztf .ymk{width:24px;height:24px;border-radius:7px;background:linear-gradient(135deg,#5b6bff,#3640d4);color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;
  box-shadow:0 4px 10px rgba(72,83,245,.4);flex-shrink:0;letter-spacing:-.02em}
.yztf .ymk.dark{background:var(--ink-900);box-shadow:none}
.yztf .ymk.white{background:#fff;color:var(--indigo-600);box-shadow:0 4px 10px rgba(11,15,31,.18)}
.yztf .lmeta .kk{font-size:7px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-400);line-height:1}
.yztf .lmeta .nm{margin-top:2px;font-weight:800;font-size:12px;line-height:1;letter-spacing:-.02em;color:var(--ink-900)}
.yztf .p-hero .kk,.yztf .p-indigo .kk,.yztf .p-dark .kk{color:rgba(255,255,255,.65)}
.yztf .p-hero .nm,.yztf .p-indigo .nm,.yztf .p-dark .nm{color:#fff}
.yztf .eye{font-size:7.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .p-hero .eye,.yztf .p-indigo .eye,.yztf .p-dark .eye{color:rgba(255,255,255,.7)}
.yztf .h-sec{font-weight:800;letter-spacing:-.025em;line-height:1.1;color:var(--ink-900);font-size:15px;margin-top:3px}
.yztf .p-hero .h-sec,.yztf .p-dark .h-sec{color:#fff}
.yztf .feats{margin-top:11px;display:flex;flex-direction:column;gap:6px;flex:1}
.yztf .feat{background:#fff;border-radius:11px;padding:7px 8px;display:flex;align-items:center;gap:8px;
  box-shadow:0 1px 0 rgba(11,15,31,.04),0 4px 10px -6px rgba(11,15,31,.1)}
.yztf .fico{flex-shrink:0;width:21px;height:21px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px}
.yztf .ic-i{background:var(--indigo-50);color:var(--indigo-600)}
.yztf .ic-m{background:var(--mint-bg);color:var(--mint)}
.yztf .ic-l{background:var(--warn-bg);color:var(--warn)}
.yztf .ic-c{background:var(--coral-bg);color:var(--coral)}
.yztf .ic-v{background:#f0ebff;color:#6b4fe0}
.yztf .ic-s{background:#e5f4ff;color:#2a7dc2}
.yztf .fnm{font-size:10px;font-weight:800;color:var(--ink-900);letter-spacing:-.01em;line-height:1.15}
.yztf .fds{margin-top:1px;font-size:8px;color:var(--ink-500);line-height:1.3;font-weight:500}
.yztf .steps{margin-top:11px;display:flex;flex-direction:column;gap:8px;flex:1}
.yztf .step{display:flex;gap:9px;align-items:flex-start}
.yztf .snum{flex-shrink:0;width:23px;height:23px;border-radius:8px;background:linear-gradient(135deg,#eef0ff,#e0e4ff);
  color:var(--indigo-700);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px}
.yztf .sh{font-size:11px;font-weight:800;color:var(--ink-900);letter-spacing:-.015em;line-height:1.1}
.yztf .sp{margin-top:2px;font-size:8.5px;color:var(--ink-500);line-height:1.35;font-weight:500}
.yztf .cover-h{margin-top:16px;position:relative;z-index:1}
.yztf .cover-h h1{font-size:19px;line-height:1.08;color:#fff;letter-spacing:-.035em;font-weight:800;margin:0}
.yztf .cover-h p{margin-top:7px;font-size:9px;color:rgba(255,255,255,.85);line-height:1.5;font-weight:500}
.yztf .qr-card{margin-top:13px;background:#fff;border-radius:14px;padding:11px;box-shadow:0 18px 40px -12px rgba(11,15,31,.45);
  display:flex;flex-direction:column;align-items:center;gap:7px;position:relative;z-index:1}
.yztf .qr-card .qr{width:84px;height:84px}
.yztf .qr-card .qr svg,.yztf .qr-card .qr img{width:100%;height:100%;display:block}
.yztf .qcap{text-align:center}
.yztf .qcap .t1{font-size:9px;color:var(--ink-900);font-weight:700;letter-spacing:-.01em}
.yztf .qcap .t2{margin-top:2px;font-size:7.5px;color:var(--ink-500);font-family:ui-monospace,Menlo,monospace;word-break:break-all}
.yztf .cover-ban{margin:auto -12px -13px;padding:9px 12px;background:rgba(255,255,255,.14);color:#fff;font-size:9px;
  font-weight:700;text-align:center;border-top:1px solid rgba(255,255,255,.14);position:relative;z-index:1}
.yztf .cover-ban .lem{color:var(--lemon)}
.yztf .priceblk{margin-top:14px}
.yztf .price-num{font-weight:800;font-size:42px;line-height:1;color:#fff;letter-spacing:-.04em}
.yztf .price-num .per{font-size:14px;font-weight:600;color:rgba(255,255,255,.7)}
.yztf .price-note{margin-top:4px;font-size:9px;color:rgba(255,255,255,.8);font-weight:500}
.yztf .perks{margin-top:14px;display:flex;flex-direction:column;gap:7px;flex:1}
.yztf .perk{display:flex;align-items:center;gap:8px;font-size:9.5px;color:rgba(255,255,255,.92);font-weight:600}
.yztf .pchk{flex-shrink:0;width:15px;height:15px;border-radius:50%;background:rgba(255,255,255,.16);color:var(--lemon);
  display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900}
.yztf .cta{margin-top:auto;background:#fff;border-radius:12px;padding:11px;text-align:center;
  box-shadow:0 14px 28px -12px rgba(11,15,31,.4);position:relative;z-index:1}
.yztf .cta .cl{font-size:8px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--indigo-600)}
.yztf .cta .lk{margin-top:4px;font-size:12px;font-weight:800;color:var(--ink-900);letter-spacing:-.02em}
.yztf .pop{position:absolute;top:13px;right:13px;background:var(--lemon);color:var(--ink-900);font-size:7.5px;
  font-weight:800;letter-spacing:.1em;padding:3px 7px;border-radius:999px;z-index:3}
.yztf .cats{margin-top:11px;display:grid;grid-template-columns:1fr 1fr;gap:5px}
.yztf .cat{background:#fff;border-radius:9px;padding:7px;display:flex;align-items:center;gap:6px;font-size:9px;
  color:var(--ink-900);font-weight:700;box-shadow:0 3px 9px -6px rgba(11,15,31,.12)}
.yztf .cico{width:18px;height:18px;border-radius:6px;background:var(--indigo-50);color:var(--indigo-600);
  display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0}
.yztf .quote{margin-top:auto;background:#fff;border-radius:12px;padding:11px;border-left:3px solid var(--indigo-600);
  box-shadow:0 6px 16px -8px rgba(11,15,31,.12)}
.yztf .qstars{color:var(--lemon);font-size:10px;letter-spacing:1px}
.yztf .quote p{margin-top:4px;font-size:10px;line-height:1.4;color:var(--ink-900);font-weight:600}
.yztf .qfoot{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:8.5px;color:var(--ink-500);font-weight:600}
.yztf .qav{width:16px;height:16px;border-radius:50%;background:linear-gradient(135deg,#ffc94a,#ff7a6b);color:#fff;
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:8px}
.yztf .clist{margin-top:13px;display:flex;flex-direction:column;gap:9px}
.yztf .crow{display:flex;align-items:center;gap:9px;font-size:10px;color:#fff;font-weight:600}
.yztf .cic{width:22px;height:22px;border-radius:7px;background:rgba(255,255,255,.1);display:flex;align-items:center;
  justify-content:center;flex-shrink:0;font-size:11px}
.yztf .mini-qr{margin-top:auto;display:flex;gap:9px;align-items:center;background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.08);border-radius:11px;padding:9px}
.yztf .mini-qr .qr{width:52px;height:52px;background:#fff;border-radius:7px;padding:4px;flex-shrink:0}
.yztf .mini-qr .qr svg{width:100%;height:100%;display:block}
.yztf .mqt{font-size:8.5px;color:rgba(255,255,255,.85);line-height:1.4;font-weight:500}
.yztf .mqt b{color:#fff;font-weight:800}
.yztf .foot{margin-top:13px;display:flex;justify-content:space-between;align-items:center;padding-top:9px;
  border-top:1px solid rgba(255,255,255,.1)}
.yztf .foot small{font-size:8px;color:rgba(255,255,255,.45);font-weight:500}
.yztf .controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap;justify-content:center}
.yztf .ctl{display:flex;flex-direction:column;gap:5px;align-items:center}
.yztf .ctl label{font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-400)}
.yztf .ctl input[type="range"]{width:120px;accent-color:var(--indigo-600);cursor:pointer}
.yztf .flipbtn{background:var(--indigo-600);color:#fff;border:none;border-radius:11px;padding:9px 16px;font-size:12px;
  font-weight:700;cursor:pointer;letter-spacing:-.01em;box-shadow:0 8px 20px -8px rgba(72,83,245,.6);transition:transform .12s}
.yztf .flipbtn:hover{transform:translateY(-1px)}
.yztf .flipbtn:active{transform:translateY(0)}
@media (max-width:420px){.yztf .stage{height:340px;transform:scale(.82)}}
`;

type Props = {
  name?: string;
  slug?: string;
  category?: string;
  botUsername?: string;
  /** Real QR image (object URL or data URL). Falls back to decorative QR. */
  qrUrl?: string | null;
};

export default function BrochureTrifold3D({
  name,
  slug,
  category,
  botUsername = "Yozuv_cl_bot",
  qrUrl,
}: Props) {
  const [fold, setFold] = useState(42); // 0 flat .. 100 folded
  const [spin, setSpin] = useState(-16); // view angle
  const [back, setBack] = useState(false);
  const [flipping, setFlipping] = useState(false);

  const handle = `t.me/${botUsername}?start=${slug || ""}`;
  const catLabel = categoryLabel(category);
  const bizName = name || "Yozuv";

  const supportQr = useMemo(() => decorativeQr("https://t.me/YozuvSupport", 23), []);
  const coverQr = useMemo(() => decorativeQr(handle, 27), [handle]);

  const t = fold / 100;
  const foldAngle = `${(t * 72).toFixed(2)}deg`;
  const shade = (0.08 + t * 0.5).toFixed(3);
  const rotateY = spin + (back ? 180 : 0);

  const triStyle: React.CSSProperties & Record<string, string | number> = {
    transform: `rotateX(7deg) rotateY(${rotateY}deg)`,
    transition: flipping ? "transform .5s cubic-bezier(.4,0,.2,1)" : "transform .15s linear",
    ["--fa"]: foldAngle,
    ["--sh"]: shade,
  };

  function flip() {
    if (flipping) return;
    setFlipping(true);
    // swap content at the rotation midpoint so text never reads mirrored
    window.setTimeout(() => setBack((b) => !b), 250);
    window.setTimeout(() => setFlipping(false), 520);
  }

  const frontPanels = [
    // LEFT — features
    <div className="pad p-light" key="f-left">
      <div className="logo">
        <span className="ymk">Y</span>
        <div className="lmeta">
          <div className="kk">Telegram Mini App</div>
          <div className="nm">Yozuv</div>
        </div>
      </div>
      <div className="head">
        <div className="eye">Imkoniyatlar</div>
        <div className="h-sec">Barcha vositalar</div>
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
    </div>,
    // CENTER — how it works
    <div className="pad p-white" key="f-center">
      <div className="logo">
        <span className="ymk dark">Y</span>
        <div className="lmeta">
          <div className="kk">4 Qadam</div>
          <div className="nm">Qanday ishlaydi</div>
        </div>
      </div>
      <div className="head">
        <div className="eye">Boshlash oson</div>
        <div className="h-sec">Toʻrt qadamda</div>
      </div>
      <div className="steps">
        {[
          ["01", "Roʻyxatdan oʻting", "Biznes va xizmatlarni kiriting"],
          ["02", "QR oling", "Tizim avtomatik yaratadi"],
          ["03", "Chop eting", "Broshyurani ilib qoʻying"],
          ["04", "Tayyor!", "Mijozlar oʻzi yoziladi"],
        ].map(([n, h, p]) => (
          <div className="step" key={n}>
            <div className="snum">{n}</div>
            <div>
              <div className="sh">{h}</div>
              <div className="sp">{p}</div>
            </div>
          </div>
        ))}
      </div>
    </div>,
    // RIGHT — cover (business + real QR)
    <div className="pad p-hero" key="f-right">
      <div className="blob" style={{ width: 150, height: 150, right: -50, top: -40, background: "rgba(255,255,255,.10)" }} />
      <div className="blob" style={{ width: 70, height: 70, right: 50, top: 50, background: "rgba(255,201,74,.30)", filter: "blur(3px)" }} />
      <div className="logo">
        <span className="ymk white">Y</span>
        <div className="lmeta">
          <div className="kk">{catLabel}</div>
          <div className="nm">Yozuv</div>
        </div>
      </div>
      <div className="cover-h">
        <h1>{bizName}</h1>
        <p>Telegram orqali yoziling — xizmat va vaqtni tanlang, biz eslatib turamiz.</p>
      </div>
      <div className="qr-card">
        <div className="qr">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="QR" />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: coverQr }} />
          )}
        </div>
        <div className="qcap">
          <div className="t1">Skaner qiling va yoziling</div>
          <div className="t2">{handle}</div>
        </div>
      </div>
      <div className="cover-ban">
        <span className="lem">★</span> Online yozilish · 24/7
      </div>
    </div>,
  ];

  const backPanels = [
    // LEFT — pricing
    <div className="pad p-indigo" key="b-left">
      <div className="pop">MASHHUR</div>
      <div className="blob" style={{ width: 150, height: 150, right: -50, top: -50, background: "rgba(255,255,255,.10)" }} />
      <div className="logo">
        <span className="ymk white">Y</span>
        <div className="lmeta">
          <div className="kk">Tarif</div>
          <div className="nm">Oylik reja</div>
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
    </div>,
    // CENTER — categories + quote
    <div className="pad p-light" key="b-center">
      <div className="logo">
        <span className="ymk dark">Y</span>
        <div className="lmeta">
          <div className="kk">Kim uchun</div>
          <div className="nm">Kichik biznes</div>
        </div>
      </div>
      <div className="head">
        <div className="eye">Kategoriyalar</div>
        <div className="h-sec">Qaysi bizneslar?</div>
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
    </div>,
    // RIGHT — contact
    <div className="pad p-dark" key="b-right">
      <div className="blob" style={{ width: 150, height: 150, right: -50, top: -50, background: "rgba(255,255,255,.10)", filter: "blur(18px)" }} />
      <div className="logo">
        <span className="ymk white">Y</span>
        <div className="lmeta">
          <div className="kk">Bogʻlanish</div>
          <div className="nm">Yozuv jamoasi</div>
        </div>
      </div>
      <div className="head">
        <div className="eye">Kontakt</div>
        <div className="h-sec">Savollar bormi?</div>
      </div>
      <div className="clist">
        <div className="crow">
          <span className="cic">🌐</span>yozuv.uz
        </div>
        <div className="crow">
          <span className="cic">✈️</span>@{botUsername}
        </div>
        <div className="crow">
          <span className="cic">✉️</span>hello@yozuv.uz
        </div>
        <div className="crow">
          <span className="cic">📍</span>Toshkent, Oʻzbekiston
        </div>
      </div>
      <div className="mini-qr">
        <div className="qr" dangerouslySetInnerHTML={{ __html: supportQr }} />
        <div className="mqt">
          <b>Yordam uchun</b>
          <br />
          Skaner qiling
          <br />@YozuvSupport
        </div>
      </div>
      <div className="foot">
        <div className="logo">
          <span className="ymk white" style={{ width: 18, height: 18, fontSize: 10 }}>
            Y
          </span>
          <div className="lmeta">
            <div className="nm" style={{ fontSize: 11 }}>
              Yozuv
            </div>
          </div>
        </div>
        <small>© 2026 Yozuv</small>
      </div>
    </div>,
  ];

  const panels = back ? backPanels : frontPanels;
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
