"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileDown, FileText, Share2 } from "lucide-react";
import { ScreenHeader, TourFloat, YzLogo, useToast } from "@/components/yz";
import type { TourStep } from "@/components/yz";
import BrochureTrifold3D from "@/components/qr/BrochureTrifold3D";

type BrochureSvc = { name: string; price: number; duration_minutes: number; is_active: boolean };
type BrochureDay = { day_of_week: number; start_time: string; end_time: string; is_working: boolean };
import { apiBase, apiFetch, getToken } from "@/lib/api";
import type { BusinessMe } from "@/types";
import { usePageTour } from "@/lib/use-page-tour";

const QR_TOUR: TourStep[] = [
  {
    targetSelector: "[data-tour='qr-image']",
    title: "Sizning QR kodingiz",
    body:
      "Bu QR kodni vizit kartochkangizga, eshikka, oynaga yoki post-ga joylashtiring. Mijoz skanerlaydi — bot ochiladi va u darhol yozilishi mumkin.",
    mode: "info",
  },
  {
    targetSelector: "[data-tour='qr-download']",
    title: "Yuklab oling va chop eting",
    body:
      "Tugmani bossangiz QR rasm sizning telefoningizga tushadi. Pastdagi 'PDF' tugmasi esa to'liq broshyurani — xizmatlar va narxlar bilan — chop etishga tayyor variantda beradi.",
    mode: "info",
  },
];

export default function QrPage() {
  const router = useRouter();
  const toast = useToast();
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [services, setServices] = useState<BrochureSvc[]>([]);
  const [schedule, setSchedule] = useState<BrochureDay[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const tour = usePageTour("qr_v1", QR_TOUR);

  useEffect(() => {
    let revoked = false;
    const urls: string[] = [];
    (async () => {
      const token = getToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      try {
        const me = await apiFetch<BusinessMe>("/api/business/me");
        if (revoked) return;
        setBiz(me);
        // brochure data — best-effort, never blocks the page
        apiFetch<BrochureSvc[]>("/api/business/me/services")
          .then((s) => !revoked && setServices(s))
          .catch(() => {});
        apiFetch<BrochureDay[]>("/api/business/me/schedule")
          .then((d) => !revoked && setSchedule(d))
          .catch(() => {});
      } catch (e) {
        const msg = (e as Error).message || "";
        if (/business not found/i.test(msg) || /404/.test(msg)) {
          router.replace("/dashboard/onboarding");
          return;
        }
        return;
      }
      try {
        const r = await fetch(`${apiBase()}/api/business/me/qr`, { headers });
        if (r.ok) {
          const u = URL.createObjectURL(await r.blob());
          urls.push(u);
          if (!revoked) setQrUrl(u);
        }
      } catch {}
      try {
        const r = await fetch(`${apiBase()}/api/business/me/brochure`, { headers });
        if (r.ok) {
          const u = URL.createObjectURL(await r.blob());
          urls.push(u);
          if (!revoked) setPdfUrl(u);
        }
      } catch {}
    })();
    return () => {
      revoked = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [router]);

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "Yozuv_cl_bot";
  const telegramLink = biz ? `https://t.me/${botUsername}?start=${biz.slug}` : "";

  async function downloadBrochure() {
    if (!biz) return;
    setDownloading(true);
    try {
      const token = getToken();
      // In Telegram WebApp (especially mobile) blob downloads don't
      // trigger the OS save dialog. Hand off to the system browser via
      // WebApp.openLink with a token-in-query URL.
      type TgWebApp = { openLink?: (u: string, opts?: { try_instant_view?: boolean }) => void };
      const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
      if (tg?.openLink && token) {
        const url = `${apiBase()}/api/business/me/brochure?token=${encodeURIComponent(token)}`;
        tg.openLink(url, { try_instant_view: false });
        toast("Brauzerda ochilmoqda…");
        return;
      }
      // Plain browser path — blob + <a download> works.
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${apiBase()}/api/business/me/brochure`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yozuv-${biz.slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Broshyura yuklandi");
    } catch (e) {
      toast((e as Error).message || "Xatolik");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadQr() {
    if (!biz || !qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `yozuv-${biz.slug}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("QR yuklandi");
  }

  async function shareLink() {
    if (!telegramLink || !biz) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: biz.name, text: telegramLink, url: telegramLink });
        return;
      }
    } catch {}
    navigator.clipboard?.writeText(telegramLink);
    setCopied(true);
    toast("Havola nusxalandi");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <ScreenHeader title="QR kod" subtitle="Mijozlar uchun havola" />

      <div className="mt-2 px-4 md:px-0">
        {/* QR feature-карта — единственный яркий момент экрана. Тёмный
            indigo-градиент, на нём «парящая» белая карточка с QR. */}
        <div
          data-tour="qr-image"
          className="relative overflow-hidden rounded-4xl p-6 text-center text-white"
          style={{
            background: "linear-gradient(135deg,#7C5CFF 0%,#4853F5 100%)",
            boxShadow: "0 18px 36px -18px rgba(72,83,245,0.6)",
          }}
        >
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

          <div className="relative mb-1 flex items-center justify-center gap-2">
            <YzLogo size={26} variant="light" />
            <div className="font-display text-[17px] font-extrabold tracking-tight text-white">
              {biz?.name || "Yozuv"}
            </div>
          </div>
          <div className="relative text-[13px] font-semibold text-white/80">Skanerlang va yoziling</div>

          <div className="relative mx-auto mt-5 grid h-60 w-60 place-items-center rounded-[26px] bg-white p-4 shadow-[0_24px_50px_-20px_rgba(11,15,31,0.45)]">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR" className="h-full w-full" />
            ) : (
              <div className="text-xs text-ink-400">Yuklanmoqda…</div>
            )}
          </div>

          <div className="relative mx-auto mt-5 inline-block max-w-full break-all rounded-full bg-white/15 px-3.5 py-1.5 font-mono text-[11px] font-medium text-white/85 backdrop-blur">
            {telegramLink || "—"}
          </div>
        </div>

        <div data-tour="qr-download">
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button onClick={downloadQr} disabled={!qrUrl} className="btn-primary whitespace-nowrap">
              <Download className="mr-2 h-4 w-4" /> QR yuklash
            </button>
            <button onClick={shareLink} disabled={!telegramLink} className="btn-soft whitespace-nowrap">
              <Share2 className="mr-2 h-4 w-4" /> {copied ? "✓ Nusxa" : "Ulashish"}
            </button>
          </div>

          <div className="card-soft mt-4 p-4">
            <div className="mb-1">
              <div className="font-display text-[15px] font-bold text-ink-900">3D broshyura</div>
              <div className="mt-0.5 text-xs text-ink-500">Burab koʻring · aylantiring · orqa tomonni oching</div>
            </div>
            <BrochureTrifold3D
              name={biz?.name}
              slug={biz?.slug}
              category={biz?.category}
              botUsername={botUsername}
              qrUrl={qrUrl}
              logoUrl={biz?.logo_url}
              services={services}
              address={biz?.address}
              phone={biz?.phone}
              schedule={schedule}
            />
          </div>

          <div className="card-soft mt-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-[15px] font-bold text-ink-900">Broshyura</div>
                <div className="mt-0.5 text-xs text-ink-500">A5 PDF — xizmatlar va QR</div>
              </div>
              <button
                onClick={downloadBrochure}
                disabled={downloading || !biz}
                className="btn-primary px-4 py-3 text-sm"
              >
                <FileDown className="mr-2 h-4 w-4" />
                {downloading ? "…" : "PDF"}
              </button>
            </div>
            {pdfUrl && (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                title="Broshyura preview"
                className="mt-3 h-80 w-full rounded-2xl border border-ink-100 bg-white"
              />
            )}
          </div>
        </div>
      </div>

      <TourFloat tour={tour} />
    </div>
  );
}
