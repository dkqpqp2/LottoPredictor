import type { MetadataRoute } from "next";

const SITE_URL = "https://lotto-predictor-gilt.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/collect",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
