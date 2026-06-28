import { Star, Store } from "lucide-react";
import { apiBase } from "@/lib/api";

// Public catalog item — same shape the map/list views consume. Only the
// fields this section actually renders are typed here.
type CatalogItem = {
  id: string;
  name: string;
  category: string;
  viloyat: string;
  tuman: string;
  rating: number;
  reviews_count: number;
};

// Uzbek labels for the categories the catalog exposes. Unknown → generic.
const CATEGORY_LABEL: Record<string, string> = {
  barbershop: "Barbershop",
  salon: "Salon",
  dentist: "Stomatologiya",
  tutor: "O‘qituvchi",
  photo: "Fotograf",
  massage: "Massaj",
  fitness: "Fitnes",
  clinic: "Klinika",
  other: "Biznes",
};

async function fetchCatalog(): Promise<CatalogItem[]> {
  try {
    const res = await fetch(`${apiBase()}/api/business/catalog?limit=100`, {
      // Public, slow-changing data — cache at the edge for an hour so the
      // landing page stays fast but the count/rating still refresh.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as CatalogItem[]) : [];
  } catch {
    // Backend down / network error — show nothing rather than a stale or
    // fake number.
    return [];
  }
}

/**
 * Social proof on REAL catalog data only. Renders the live business count, an
 * aggregate rating when reviews exist, and a few real businesses already on
 * Yozuv. If the catalog is empty or the fetch fails, returns null so the
 * section simply doesn't appear — never an invented number or review.
 */
export async function SocialProof() {
  const items = await fetchCatalog();
  if (items.length === 0) return null;

  const businessCount = items.length;

  // Aggregate rating across businesses that actually have reviews. If none do,
  // we just omit the rating chip — no zeros, no made-up stars.
  const rated = items.filter((it) => it.reviews_count > 0 && it.rating > 0);
  const totalReviews = rated.reduce((sum, it) => sum + it.reviews_count, 0);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, it) => sum + it.rating * it.reviews_count, 0) /
        totalReviews
      : null;

  // A small, real sample to show "already with us" — prefer the rated ones,
  // fall back to the first few. Names come straight from the catalog.
  const featured = (rated.length >= 3 ? rated : items).slice(0, 3);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="card-soft overflow-hidden p-7 md:p-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-8 md:gap-12">
            <div>
              <div className="tnum font-display text-4xl font-extrabold tracking-tighter text-ink-900 md:text-5xl">
                {businessCount}
              </div>
              <div className="mt-1 text-sm font-semibold text-ink-500">
                biznes Yozuvda
              </div>
            </div>

            {avgRating !== null && (
              <div>
                <div className="flex items-center gap-1.5">
                  <Star
                    className="h-7 w-7 text-amber-500"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                  <span className="tnum font-display text-4xl font-extrabold tracking-tighter text-ink-900 md:text-5xl">
                    {avgRating.toFixed(1)}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-ink-500">
                  o‘rtacha baho · {totalReviews} ta sharh
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {featured.map((it) => {
              const region = [it.tuman, it.viloyat].filter(Boolean).join(", ");
              const niche = CATEGORY_LABEL[it.category] || "Biznes";
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-indigo-600 shadow-soft-sm">
                    <Store className="h-5 w-5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-display text-sm font-bold tracking-tight text-ink-900">
                      {it.name}
                    </div>
                    <div className="truncate text-xs font-medium text-ink-500">
                      {region ? `${niche} · ${region}` : niche}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
