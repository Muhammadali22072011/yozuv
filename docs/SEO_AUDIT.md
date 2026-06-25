I have everything I need. The catalog map page and biz page have no `metadata` for `metadataBase`, no sitemap, no robots, no LocalBusiness schema. Let me confirm there's no catalog map metadata export (it's a client component, so it can't have one) and check whether `metadataBase` is set anywhere.

I have a complete picture. Producing the audit.

---

# SEO Audit — Yozuv public surface (`D:/yozuv/frontend`)

Next.js 14 App Router, single-locale (`uz`), Telegram-first product. Public surface = landing (`/`), per-business profiles (`/biz/[slug]`, SSR with OG), catalog map (`/catalog/map`). Target intent: local queries like **"Toshkent barber yozilish"**, **"salon yozilish Toshkent"**, **"stomatolog navbat"**.

## Executive summary

The biggest structural problem: **Google has almost no way to discover or rank the business pages, which are the only pages that can win local-intent queries.** There is no sitemap, no `robots.txt`, no internal link path from the landing to `/biz/[slug]` or `/catalog/map`, and no `LocalBusiness` structured data. The SSR + OG work on `/biz/[slug]` is solid plumbing, but it's pointing at an undiscoverable, schema-less page. Fixing discoverability + schema is where the entire local-SEO upside sits.

---

## 🥇 Biggest local-SEO win

**Add `LocalBusiness` JSON-LD to `/biz/[slug]` + make those pages discoverable (sitemap + internal links).** This is one coherent win because schema without discoverability is wasted, and discoverability without schema leaves the rich-result/local-pack signals on the table. Each `/biz/[slug]` page already has the exact data Google wants for a local entity — name, address, geo coords, phone, category, aggregate rating — but it ships none of it as structured data, and Google can't even crawl to the page. Together these are what make "Toshkent barber yozilish" winnable.

---

## Technical SEO findings

### 1. No XML sitemap — business pages are undiscoverable — Impact: High, Priority 1
**Evidence:** No `sitemap.ts`/`sitemap.xml` anywhere under `frontend/src/app` or `frontend/public` (glob returned nothing). `/biz/[slug]` pages are dynamic and have zero inbound internal links, so a crawler has no path to them.
**Fix:** Add `frontend/src/app/sitemap.ts` that fetches the catalog (the same `/api/business/catalog?limit=100` endpoint the map already uses) and emits a URL entry per business plus the static routes:
```ts
import type { MetadataRoute } from "next";
const API = process.env.NEXT_PUBLIC_API_URL || "https://yozuv.onrender.com";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yozuv.uz";
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const res = await fetch(`${API}/api/business/catalog?limit=1000`);
  const items = res.ok ? await res.json() : [];
  const biz = items.map((b: { slug: string }) => ({
    url: `${SITE}/biz/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.8,
  }));
  return [
    { url: SITE, priority: 1 },
    { url: `${SITE}/catalog/map`, priority: 0.6 },
    ...biz,
  ];
}
```

### 2. No `robots.txt` — Impact: Medium, Priority 1
**Evidence:** No `robots.ts` / `public/robots.txt`.
**Fix:** Add `frontend/src/app/robots.ts` allowing crawl, disallowing private app routes (`/auth`, `/dashboard`, etc.), and pointing at the sitemap:
```ts
import type { MetadataRoute } from "next";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yozuv.uz";
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/biz/", "/catalog/"], disallow: ["/auth/", "/dashboard/", "/api/"] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
```

### 3. No `metadataBase` → relative OG/canonical URLs break — Impact: High, Priority 1
**File:** `D:/yozuv/frontend/src/app/layout.tsx` (lines 13-21).
**Evidence:** `metadata` has no `metadataBase`. Next.js needs it to resolve relative OG image URLs and canonicals; without it you get build warnings and unreliable absolute URLs in social/canonical tags. The biz page works around this manually by prefixing `${API}` onto image URLs (line 89), which is a symptom of the missing base.
**Fix:** Add to the root `metadata`:
```ts
metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://yozuv.uz"),
alternates: { canonical: "/" },
```
Then biz/landing pages can use site-relative `alternates.canonical` and Next resolves them correctly.

### 4. No canonical tags on any page — Impact: Medium, Priority 2
**Files:** `layout.tsx`, `biz/[slug]/page.tsx`.
**Evidence:** No `alternates.canonical` in any `metadata`/`generateMetadata`. Risk of duplicate-URL dilution (trailing slash, query params on the map, casing).
**Fix:** Self-referencing canonical per page. In `generateMetadata` (biz page) add `alternates: { canonical: \`/biz/${biz.slug}\` }`.

### 5. Catalog map is fully client-rendered with no metadata — Impact: High (for that page), Priority 2
**File:** `D:/yozuv/frontend/src/app/catalog/map/page.tsx` (line 1 `"use client"`).
**Evidence:** Because it's a client component it cannot export `metadata`, so it inherits only the generic root title/description. The business list is fetched client-side (lines 53-65) so crawlers see an empty `<div>` — no indexable content, no links to individual businesses. This page could be the local "directory" hub but currently contributes nothing to SEO.
**Fix:** Split it: keep the Leaflet map as a client child, but make `page.tsx` a server component that exports `metadata` (title like `Toshkentda yaqin atrofdagi bizneslar — Yozuv`) and SSR-renders a real `<ul>` of businesses as `<a href="/biz/[slug]">` links below/beside the map. This simultaneously (a) gives the page crawlable local content, (b) creates the internal link path to every `/biz/[slug]` (fixes finding #1's orphan problem), and (c) adds an `ItemList`-eligible directory.

### 6. unpkg-hosted Leaflet — third-party SPOF + CWV risk — Impact: Medium, Priority 3
**File:** `D:/yozuv/frontend/src/lib/leaflet.ts` (lines 5-6, `unpkg.com/leaflet@1.9.4`).
**Evidence:** Leaflet CSS+JS loaded at runtime from `unpkg.com`. Render-blocking external origin (extra DNS/TLS/connection), no SRI, no version pinning guarantee on the CDN's availability — a slow/down unpkg directly delays LCP and can break the map. The page also renders nothing until JS fetches data *then* fetches Leaflet (two serial round-trips, lines 53→71).
**Fix:** `npm i leaflet` (already not a dep) and import it locally so it's bundled/served from your origin with proper caching; or at minimum add `<link rel="preconnect" href="https://unpkg.com">`. Bundling removes the external SPOF and improves INP/LCP on the map route.

---

## On-page SEO findings

### 7. Landing title/description ignore local + service intent — Impact: High, Priority 2
**File:** `D:/yozuv/frontend/src/app/layout.tsx` (lines 14-15).
**Evidence:** Title `"Yozuv — Telegram orqali onlayn yozilish"`, description `"Kichik biznes uchun yozilishlar, eslatmalar va analitika."` These are owner/SaaS-facing ("for small business: bookings, reminders, analytics") and contain none of the consumer local-intent terms (city, "barber", "salon", "Toshkent"). They will not rank for "Toshkent barber yozilish".
**Fix:** Two-audience strategy. Keep the landing for the B2B owner pitch but lean the discoverable consumer surface (catalog map + biz pages) on local terms. For the landing itself, broaden the description to include service categories and geography, e.g. `description: "Toshkent va butun O'zbekiston bo'ylab barbershop, salon, stomatologiya va boshqa xizmatlarga Telegram orqali onlayn yozilish."` Keep title ≤60 chars.

### 8. `/biz/[slug]` title/description lack city + service keywords — Impact: High, Priority 2
**File:** `D:/yozuv/frontend/src/app/biz/[slug]/page.tsx` (lines 90-105).
**Evidence:** Title is `\`${biz.name} — Yozuv\`` and description falls back to raw `biz.description` or `"${cat} ${viloyat} ${tuman}"`. The page-`<title>` omits the category and city for the common case where the business *has* a description, so the strongest title is wasted on just the brand name.
**Fix:** Compose the title with category + city: ``title: `${biz.name} — ${cat}, ${biz.tuman || biz.viloyat} | Onlayn yozilish` ``. This directly targets "{name} {category} {city} yozilish" queries. Keep the OG title as-is (it already includes `cat`, line 94).

### 9. OG/Twitter image uses `summary` card + tiny logo — Impact: Low/Medium, Priority 3
**File:** `D:/yozuv/frontend/src/app/biz/[slug]/page.tsx` (lines 93-104).
**Evidence:** `twitter.card: "summary"` (small square) and the only image is the business logo. Shares look weak; no large preview to drive clicks from social — a meaningful local discovery channel in UZ (Telegram/Instagram sharing).
**Fix:** Generate a dynamic OG image via `opengraph-image.tsx` (Next ImageResponse) showing business name + category + city + rating on-brand, and switch to `twitter.card: "summary_large_image"`.

### 10. Heading hierarchy: landing has no real H1; map has none — Impact: Medium, Priority 3
**Files:** `page.tsx`, `components/landing/Hero.tsx` (line 31), `catalog/map/page.tsx`.
**Evidence:** Landing's only H1 is in `Hero.tsx` ("Mijozlar Telegram orqali yoziladi") — fine, but it's owner-facing, not query-facing. The CTA section uses `<h2>Bugun boshlang</h2>` (page.tsx line 33) which is reasonable. The catalog map page (line 159) renders "Yaqin biznes" inside a `<span>`, so the page has **no H1 at all**.
**Fix:** When you convert the map page to SSR (finding #5), give it a keyworded H1, e.g. `<h1>Toshkentdagi bizneslar — onlayn yozilish</h1>`. Consider tuning the landing H1 to include a service/intent term if you want the homepage to also catch consumer queries.

### 11. Image `alt` is the bare business name; decorative emoji not hidden — Impact: Low, Priority 4
**File:** `D:/yozuv/frontend/src/app/biz/[slug]/page.tsx` (line 144).
**Evidence:** Logo `alt={biz.name}` — acceptable but thin; add context for image search. Decorative emoji placeholders (line 148 `📍`, Categories tiles) aren't aria-hidden.
**Fix:** ``alt={`${biz.name} — ${cat} logotipi`}``. Mark purely decorative emoji `aria-hidden`. Minor, but cheap E-E-A-T/accessibility polish.

---

## Structured data findings

### 12. No `LocalBusiness` schema on biz pages — Impact: High, Priority 1 — **the local-SEO centerpiece**
**File:** `D:/yozuv/frontend/src/app/biz/[slug]/page.tsx` — none present (confirmed: no `application/ld+json`, no schema import anywhere in the file).
**Evidence:** The page already loads `name`, `address`, `viloyat`, `tuman`, `latitude`, `longitude`, `phone`, `category`, and a `{ average_rating, count }` summary — the complete `LocalBusiness` + `AggregateRating` payload — but emits none of it as JSON-LD. This is the single highest-leverage structured-data gap for local intent.
**Fix:** Render a JSON-LD `<script>` in the page body. Map `biz.category` to the specific schema type where possible (`HealthAndBeautyBusiness`/`BeautySalon` for barbershop/salon, `Dentist` for dentist, etc.; fall back to `LocalBusiness`):
```tsx
const ld = {
  "@context": "https://schema.org",
  "@type": SCHEMA_TYPE[biz.category] || "LocalBusiness",
  name: biz.name,
  "@id": `${SITE}/biz/${biz.slug}`,
  url: `${SITE}/biz/${biz.slug}`,
  image: logo || `${SITE}/logo.png`,
  telephone: biz.phone || undefined,
  address: {
    "@type": "PostalAddress",
    streetAddress: biz.address || undefined,
    addressLocality: biz.tuman || undefined,
    addressRegion: biz.viloyat || undefined,
    addressCountry: "UZ",
  },
  ...(biz.latitude != null && biz.longitude != null && {
    geo: { "@type": "GeoCoordinates", latitude: biz.latitude, longitude: biz.longitude },
  }),
  ...(summary.count > 0 && {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: summary.average_rating.toFixed(1),
      reviewCount: summary.count,
    },
  }),
};
// in JSX:
<script type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
```
Validate with Google's Rich Results Test after deploy.

### 13. Services list has no `Offer`/`Service` schema — Impact: Medium, Priority 3
**File:** `D:/yozuv/frontend/src/app/biz/[slug]/page.tsx` (lines 227-247, services with name/price/duration).
**Evidence:** Service name + price (so'm) + duration are rendered as plain HTML only.
**Fix:** Add `makesOffer` / `hasOfferCatalog` (`OfferCatalog` of `Offer`→`Service` with `priceCurrency: "UZS"`) to the `LocalBusiness` node, or emit an `ItemList`. Helps eligibility for price-bearing rich results and reinforces the service-intent match.

### 14. Catalog map directory has no `ItemList` schema — Impact: Low/Medium, Priority 3
**File:** `D:/yozuv/frontend/src/app/catalog/map/page.tsx`.
**Evidence:** A list of local businesses is the textbook `ItemList`/`CollectionPage` use case, but the page is client-only with no schema.
**Fix:** As part of the SSR conversion (finding #5), emit an `ItemList` of `LocalBusiness` references (each `url: /biz/[slug]`). Makes the hub page a legitimate local directory entity.

---

## i18n / locale findings

### 15. Single-locale `uz` is fine, but mixed-script and no `og:locale` — Impact: Low, Priority 4
**Files:** `layout.tsx` (line 29 `lang="uz"`), `biz/[slug]/page.tsx` (line 110).
**Evidence:** `<html lang="uz">` is correct for the Uzbek Latin market. However the price formatter uses `toLocaleString("uz-Cyrl-UZ")` (line 110) — Cyrillic locale for grouping while the entire UI is Latin; harmless for digits but inconsistent. No `openGraph.locale: "uz_UZ"` is set. No hreflang is needed *yet* (single locale), so don't add it.
**Fix:** Use `"uz-Latn-UZ"` (or just `"uz"`) for consistency. Add `openGraph: { locale: "uz_UZ", ... }` in root metadata. If a Russian locale is ever added (common in Toshkent), that's when hreflang + reciprocal tags + `x-default` become mandatory — flag for later.

---

## Core Web Vitals risks (summary)

- **Map route, finding #5/#6:** client-only data fetch → then Leaflet fetch from unpkg = two serial network waterfalls before first paint. LCP/INP risk on the highest-local-value route. Bundle Leaflet, SSR the list, add `preconnect`.
- **Biz logo, line 141:** raw `<img>` (eslint-disabled `no-img-element`) with no width/height → CLS risk and no Next image optimization. The fixed `h-20 w-20` class mitigates CLS but you lose AVIF/WebP/responsive serving. Consider `next/image` with explicit dimensions (note: needs `images.remotePatterns` for the `${API}` host in `next.config.mjs`).
- **Landing:** mostly static server components — low risk. Good.

---

## Prioritized action plan

1. **(P1, biggest win)** Add `LocalBusiness` JSON-LD to `/biz/[slug]` (#12) + `sitemap.ts` (#1) + `robots.ts` (#2) + `metadataBase` (#3). These four together make business pages discoverable, indexable, and locally rich.
2. **(P2)** SSR the catalog map with metadata, a crawlable business list linking to each `/biz/[slug]`, and an H1 (#5, #10, #14) — fixes orphan pages and creates the local directory hub.
3. **(P2)** Local-intent titles/descriptions on biz pages and landing (#7, #8); self-canonicals (#4).
4. **(P3)** Bundle Leaflet off unpkg (#6); `Service`/`Offer` schema (#13); dynamic OG image + `summary_large_image` (#9).
5. **(P4)** Alt-text polish, `og:locale`, locale-string consistency (#11, #15).

**Files to touch:** `D:/yozuv/frontend/src/app/layout.tsx`, `D:/yozuv/frontend/src/app/biz/[slug]/page.tsx`, `D:/yozuv/frontend/src/app/catalog/map/page.tsx`, `D:/yozuv/frontend/src/lib/leaflet.ts`, `D:/yozuv/frontend/next.config.mjs`, plus new files `D:/yozuv/frontend/src/app/sitemap.ts` and `D:/yozuv/frontend/src/app/robots.ts`.