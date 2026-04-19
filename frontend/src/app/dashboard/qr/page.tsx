"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiBase, apiFetch, getToken } from "@/lib/api";
import type { BusinessMe } from "@/types";

export default function QrPage() {
  const router = useRouter();
  const [biz, setBiz] = useState<BusinessMe | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState("");
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
        if (/401|not authenticated|invalid user/i.test(msg)) {
          router.replace("/login");
          return;
        }
        setLoadErr(msg || "Ma'lumotlarni yuklab bo'lmadi");
        return;
      }

      try {
        const r = await fetch(`${apiBase()}/api/business/me/qr`, { headers });
        if (r.ok) {
          const blob = await r.blob();
          const u = URL.createObjectURL(blob);
          urls.push(u);
          if (!revoked) setQrUrl(u);
        }
      } catch {}

      try {
        const r = await fetch(`${apiBase()}/api/business/me/brochure`, { headers });
        if (r.ok) {
          const blob = await r.blob();
          const u = URL.createObjectURL(blob);
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

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "YozuvBot";
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
    } catch (e) {
      alert((e as Error).message || "Yuklab bo'lmadi");
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
  }

  async function copyLink() {
    if (!telegramLink) return;
    try {
      await navigator.clipboard.writeText(telegramLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  async function shareLink() {
    if (!telegramLink || !biz) return;
    const text = `${biz.name} — Telegram orqali yoziling: ${telegramLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: biz.name, text, url: telegramLink });
        return;
      } catch {}
    }
    copyLink();
  }

  if (loadErr) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        <div className="font-medium">Xatolik:</div>
        <div className="mt-1 break-all">{loadErr}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl">QR va broshyura</h2>
        <p className="mt-1 text-sm text-ink/60">
          Broshyurani chop eting va eshikka osing. Mijoz QR orqali yoziladi.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ─── LEFT: preview ─── */}
        <section className="rounded-xl border border-ink/10 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink/70">Jonli ko&apos;rinish</h3>
            <span className="text-[10px] uppercase tracking-wider text-ink/40">A5 · PDF</span>
          </div>

          <div className="overflow-hidden rounded-lg border border-ink/10 bg-cream">
            {pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                title="Broshyura preview"
                className="h-[520px] w-full bg-white"
              />
            ) : biz ? (
              <div className="grid h-[520px] place-items-center text-sm text-ink/50">
                Tayyorlanmoqda…
              </div>
            ) : (
              <div className="grid h-[520px] place-items-center p-6 text-center text-sm text-ink/50">
                Avval biznes ma&apos;lumotlarini to&apos;ldiring, keyin bu yerda
                broshyura ko&apos;rinadi.
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-ink/50">
            Ma&apos;lumotlar avtomatik yangilanadi — biznes yoki xizmatni o&apos;zgartirsangiz,
            broshyura ham yangilanadi.
          </p>
        </section>

        {/* ─── RIGHT: actions ─── */}
        <div className="space-y-4">
          {/* Block 1: QR */}
          <section className="rounded-xl border border-ink/10 bg-white p-5">
            <h3 className="font-serif text-lg">Sizning QR-kodingiz</h3>
            <p className="mt-1 text-xs text-ink/60">Mijozlar shu kodni skanerlaydi</p>

            <div className="mt-4 flex justify-center rounded-xl bg-cream p-5">
              {qrUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrUrl} alt="QR" className="h-48 w-48" />
              ) : (
                <div className="grid h-48 w-48 place-items-center text-xs text-ink/50">
                  Yuklanmoqda…
                </div>
              )}
            </div>

            {telegramLink && (
              <div className="mt-3 truncate rounded-md bg-ink/[0.04] px-3 py-2 text-center text-[11px] text-ink/70">
                {telegramLink}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={downloadQr} disabled={!qrUrl}>
                ⬇ PNG yuklab olish
              </Button>
              <Button variant="outline" onClick={shareLink} disabled={!telegramLink}>
                {copied ? "✓ Nusxa olindi" : "🔗 Ulashish"}
              </Button>
            </div>
          </section>

          {/* Block 2: Brochure */}
          <section className="rounded-xl border border-ink/10 bg-white p-5">
            <h3 className="font-serif text-lg">Broshyura</h3>
            <p className="mt-1 text-xs text-ink/60">
              Barcha ma&apos;lumotlar avtomatik to&apos;ldiriladi:
            </p>

            <ul className="mt-3 space-y-1.5 text-[13px] text-ink/80">
              <li className="flex items-center gap-2">
                <span className="text-[--color-blue,#005AFF]" style={{ color: "#005AFF" }}>
                  ✓
                </span>
                Biznes nomi va kategoriyasi
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: "#005AFF" }}>✓</span>
                Barcha xizmatlar va narxlar
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: "#005AFF" }}>✓</span>
                QR-kod
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: "#005AFF" }}>✓</span>
                Telefon va manzil
              </li>
            </ul>

            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={downloadBrochure}
              disabled={downloading || !biz}
            >
              {downloading ? "Tayyorlanmoqda…" : "⬇ PDF yuklab olish"}
            </Button>
          </section>

          {/* Block 3: Tip */}
          <section className="rounded-xl border border-ink/10 bg-cream p-5">
            <h4 className="text-sm font-semibold text-ink/80">💡 Qanday foydalanish</h4>
            <ol className="mt-2 space-y-1.5 text-[13px] text-ink/70">
              <li>1. PDF yuklab oling</li>
              <li>2. A5 yoki A4 qog&apos;ozga chop eting</li>
              <li>3. Do&apos;kon yoki xonangizga ilib qo&apos;ying</li>
              <li>4. Mijozlar QR-kodni skanerlaydi</li>
              <li>5. Yozilish avtomatik keladi ✓</li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
