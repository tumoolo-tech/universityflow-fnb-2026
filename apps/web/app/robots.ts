import type { MetadataRoute } from 'next';
import { robotsFor } from '@/lib/server/seo';

/** Per request, so it follows the deployment's own environment (A6-01; lib/server/seo.ts). */
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return robotsFor();
}
