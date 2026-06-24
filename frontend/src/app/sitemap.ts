import type { MetadataRoute } from "next";

// Public site URL (canonical host). Set NEXT_PUBLIC_SITE_URL in the deploy.
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yozuv.uz";
const API = process.env.NEXT_PUBLIC_API_URL || "https://yozuv.onrender.com";

// Re-fetch the catalog hourly so newly-listed businesses get discovered.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let items: { slug: string }[] = [];
  try {
    const res = await fetch(`${API}/api/business/catalog?limit=1000`, {
      next: { revalidate },
    });
    if (res.ok) items = await res.json();
  } catch {
    // Sitemap must still emit the static routes even if the API is down.
  }

  const biz: MetadataRoute.Sitemap = items
    .filter((b) => b && b.slug)
    .map((b) => ({
      url: `${SITE}/biz/${b.slug}`,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/catalog/map`, changeFrequency: "daily", priority: 0.6 },
    ...biz,
  ];
}
