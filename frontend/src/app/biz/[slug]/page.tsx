import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin, Phone, Star } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://yozuv.onrender.com";
const BOT = process.env.NEXT_PUBLIC_BOT_USERNAME || "Yozuv_cl_bot";

type Business = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  logo_url: string;
  language: string;
  viloyat: string;
  tuman: string;
  latitude: number | null;
  longitude: number | null;
};

type ServiceLite = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

type ReviewSummary = { average_rating: number; count: number };

const CATEGORY_LABEL: Record<string, string> = {
  barbershop: "Barbershop",
  salon: "Salon",
  dentist: "Stomatologiya",
  tutor: "Repetitor",
  photo: "Fotograf",
  massage: "Massaj",
  fitness: "Fitness",
  clinic: "Klinika",
  other: "Biznes",
};

// Cache the SSR fetch for 60s — frequent enough that an owner edit
// shows up quickly, cheap enough that a Twitter share storm doesn't
// hammer the backend.
async function fetchBusiness(slug: string): Promise<Business | null> {
  const res = await fetch(`${API}/api/business/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return (await res.json()) as Business;
}

async function fetchServices(slug: string): Promise<ServiceLite[]> {
  const res = await fetch(
    `${API}/api/business/${encodeURIComponent(slug)}/services`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return [];
  return (await res.json()) as ServiceLite[];
}

async function fetchSummary(slug: string): Promise<ReviewSummary> {
  const res = await fetch(
    `${API}/api/business/${encodeURIComponent(slug)}/reviews-summary`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return { average_rating: 0, count: 0 };
  return (await res.json()) as ReviewSummary;
}

export async function generateMetadata(
  { params }: { params: { slug: string } },
): Promise<Metadata> {
  const biz = await fetchBusiness(params.slug);
  if (!biz) {
    return { title: "Yozuv" };
  }
  const cat = CATEGORY_LABEL[biz.category] || "Biznes";
  const desc =
    biz.description?.trim() ||
    `${cat} ${biz.viloyat || ""} ${biz.tuman || ""}`.trim() ||
    "Telegram orqali onlayn yozilish";
  // Absolute URL for OG — relative `/api/...` won't work in WhatsApp /
  // Twitter previews where the crawler isn't on our domain.
  const logoAbs = biz.logo_url ? `${API}${biz.logo_url}` : `${API}/logo.png`;
  return {
    title: `${biz.name} — Yozuv`,
    description: desc,
    openGraph: {
      title: `${biz.name} — ${cat}`,
      description: desc,
      images: [{ url: logoAbs }],
      type: "website",
    },
    twitter: {
      card: "summary",
      title: biz.name,
      description: desc,
      images: [logoAbs],
    },
  };
}

function fmtSum(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("uz-Cyrl-UZ");
}

export default async function BusinessPage({
  params,
}: {
  params: { slug: string };
}) {
  const biz = await fetchBusiness(params.slug);
  if (!biz) notFound();

  const [services, summary] = await Promise.all([
    fetchServices(params.slug),
    fetchSummary(params.slug),
  ]);

  const cat = CATEGORY_LABEL[biz.category] || "Biznes";
  const botLink = `https://t.me/${BOT}?start=${encodeURIComponent(biz.slug)}`;
  const logo = biz.logo_url ? `${API}${biz.logo_url}` : null;

  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section
        className="relative px-6 py-12 text-white"
        style={{ background: "linear-gradient(135deg,#0B0F1F 0%,#1E2270 100%)" }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={biz.name}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-2 ring-white/20"
            />
          ) : (
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/10 text-3xl">
              📍
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              {cat}
            </div>
            <h1 className="mt-1 truncate font-display text-3xl font-extrabold tracking-tight">
              {biz.name}
            </h1>
            {summary.count > 0 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/14 px-2.5 py-1 text-xs font-bold backdrop-blur">
                <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" />
                {summary.average_rating.toFixed(1)} · {summary.count} ta sharh
              </div>
            )}
          </div>
        </div>

        {biz.description && (
          <p className="mx-auto mt-6 max-w-3xl text-[15px] leading-relaxed text-white/90">
            {biz.description}
          </p>
        )}

        <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
          <Link
            href={botLink}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-4 font-display text-[15px] font-bold text-indigo-700 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
          >
            Yozilish <ArrowRight className="h-4 w-4" />
          </Link>
          {biz.phone && (
            <a
              href={`tel:${biz.phone}`}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-4 font-display text-[15px] font-bold text-white backdrop-blur"
            >
              <Phone className="h-4 w-4" />
              {biz.phone}
            </a>
          )}
        </div>
      </section>

      {/* Address */}
      {(biz.address || biz.viloyat || biz.tuman) && (
        <section className="border-b border-ink-100 px-6 py-5">
          <div className="mx-auto flex max-w-3xl items-start gap-2 text-sm text-ink-700">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div>
              {biz.address && <div>{biz.address}</div>}
              {(biz.viloyat || biz.tuman) && (
                <div className="text-ink-400">
                  {[biz.viloyat, biz.tuman].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Services */}
      <section className="px-6 py-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
            Xizmatlar
          </h2>
          {services.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-ink-200 bg-ink-50 px-5 py-10 text-center text-sm text-ink-400">
              Hozircha xizmatlar qo&apos;shilmagan
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-2xl border border-ink-100 bg-white p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate font-display text-[15px] font-bold text-ink-900">
                      {s.name}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-400">
                      {s.duration_minutes} daq
                    </div>
                  </div>
                  <div className="ml-4 shrink-0 font-display text-[15px] font-bold text-indigo-700">
                    {fmtSum(s.price)} so&apos;m
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8 text-center">
            <Link
              href={botLink}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-7 py-4 font-display text-[15px] font-bold text-white"
            >
              Botda yozilish <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-ink-50 px-6 py-8 text-center">
        <Link href="/" className="text-sm font-semibold text-indigo-700">
          Yozuv haqida
        </Link>
      </footer>
    </main>
  );
}
