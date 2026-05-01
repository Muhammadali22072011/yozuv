"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileDown, Share2 } from "lucide-react";
import { ScreenHeader, YzLogo, useToast } from "@/components/yz";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import type { BusinessMe } from "@/types";

export default function QrPage() {
  const router = useRouter();
  const toast = useToast();
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

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
        <div className="rounded-[28px] border-[1.5px] border-ink-100 bg-gradient-to-b from-white to-ink-50 px-5 py-6 text-center shadow-soft-lg">
          <div className="mb-1 flex items-center justify-center gap-2">
            <YzLogo size={24} />
            <div className="font-display text-[17px] font-extrabold tracking-tight text-ink-900">
              {biz?.name || "Yozuv"}
            </div>
          </div>
          <div className="text-[13px] font-medium text-ink-500">Skanerlang va yoziling</div>

          <div className="mx-auto mt-4 grid h-60 w-60 place-items-center rounded-[20px] bg-white p-4 shadow-[0_10px_30px_rgba(11,15,31,0.08),_inset_0_0_0_1px_rgba(11,15,31,0.06)]">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="QR" className="h-full w-full" />
            ) : (
              <div className="text-xs text-ink-400">Yuklanmoqda…</div>
            )}
          </div>

          <div className="mt-4 break-all font-mono text-xs text-ink-500">{telegramLink || "—"}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button onClick={downloadQr} disabled={!qrUrl} className="btn-primary">
            <Download className="mr-2 h-4 w-4" /> QR yuklash
          </button>
          <button onClick={shareLink} disabled={!telegramLink} className="btn-soft">
            <Share2 className="mr-2 h-4 w-4" /> {copied ? "✓ Nusxa" : "Ulashish"}
          </button>
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
  );
}
