import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yozuv.uz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Public discovery surface: landing, business profiles, catalog.
      allow: ["/", "/biz/", "/catalog/"],
      // Private app + API are not for crawlers.
      disallow: ["/auth/", "/dashboard/", "/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
