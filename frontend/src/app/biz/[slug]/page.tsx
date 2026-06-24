import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, MapPin, Phone, Sparkles, Star } from "lucide-react";

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
    <main className="min-h-screen bg-ink-50">
      {/* Hero — светлая «воздушная» шапка (Havodor): тёмный текст на
          холсте, лого в мягком пастельном чипе, единственный яркий
          акцент — кнопка «Yozilish» (индиго-градиент). */}
      <section className="px-5 pb-2 pt-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <div className="card-lg p-5 sm:p-6">
            <div className="flex items-center gap-4 sm:gap-5">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt={biz.name}
                  className="h-20 w-20 shrink-0 rounded-3xl object-cover shadow-soft ring-1 ring-ink-100"
                />
              ) : (
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-indigo-50 text-3xl">
                  📍
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="eyebrow">{cat}</div>
                <h1 className="mt-1 truncate font-display text-[26px] font-extrabold tracking-tighter text-ink-900 sm:text-3xl">
                  {biz.name}
                </h1>
                {summary.count > 0 && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-warn-bg px-2.5 py-1 text-xs font-bold text-warn">
                    <Star className="h-3 w-3 fill-lemon text-lemon" />
                    <span className="tnum">{summary.average_rating.toFixed(1)}</span> · {summary.count} ta sharh
                  </div>
                )}
              </div>
            </div>

            {biz.description && (
              <p className="mt-5 text-[15px] leading-relaxed text-ink-500">
                {biz.description}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={botLink}
                className="tap inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-7 py-4 font-display text-[15px] font-bold text-white"
                style={{
                  background: "linear-gradient(135deg,#7C5CFF,#4853F5)",
                  boxShadow: "0 16px 32px -16px rgba(72,83,245,0.6)",
                }}
              >
                Yozilish <ArrowRight className="h-4 w-4" />
              </Link>
              {biz.phone && (
                <a
                  href={`tel:${biz.phone}`}
                  className="btn-soft tap gap-2 text-[15px]"
                >
                  <Phone className="h-4 w-4 text-indigo-600" />
                  <span className="tnum">{biz.phone}</span>
                </a>
              )}
            </div>
          </div>

          {/* Address */}
          {(biz.address || biz.viloyat || biz.tuman) && (
            <div className="card-soft mt-3 flex items-start gap-3 p-4">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="min-w-0 pt-0.5 text-sm text-ink-700">
                {biz.address && <div className="font-semibold text-ink-900">{biz.address}</div>}
                {(biz.viloyat || biz.tuman) && (
                  <div className="mt-0.5 text-ink-400">
                    {[biz.viloyat, biz.tuman].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Services */}
      <section className="px-5 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="section-title text-xl">Xizmatlar</h2>
          {services.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-ink-200 bg-white px-5 py-10 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-600">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="text-sm text-ink-400">
                Hozircha xizmatlar qo&apos;shilmagan
              </div>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {services.map((s) => (
                <li
                  key={s.id}
                  className="card-soft flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <div className="truncate font-display text-[15px] font-bold tracking-tight text-ink-900">
                      {s.name}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-400">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="tnum">{s.duration_minutes}</span> daq
                    </div>
                  </div>
                  <div className="ml-1 shrink-0 font-display text-[15px] font-extrabold tracking-tight text-indigo-700">
                    <span className="tnum">{fmtSum(s.price)}</span> so&apos;m
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-8">
            <Link
              href={botLink}
              className="btn-primary tap w-full gap-2 text-[15px]"
            >
              Botda yozilish <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 pb-10 pt-2 text-center">
        <Link href="/" className="text-sm font-semibold text-indigo-700">
          Yozuv haqida
        </Link>
      </footer>
    </main>
  );
}
