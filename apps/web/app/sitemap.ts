import type { MetadataRoute } from 'next';
import { sitemapFor } from '@/lib/server/seo';

/** Per request, so it follows the deployment's own environment (A6-01; lib/server/seo.ts). */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapFor();
}
