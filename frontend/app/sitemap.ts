import type { MetadataRoute } from "next";

const SITE_URL = "https://lotto-predictor-gilt.vercel.app";

const ROUTES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/stats", priority: 0.8 },
  { path: "/draws", priority: 0.8 },
  { path: "/tarot", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "weekly",
    priority,
  }));
}
