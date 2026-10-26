import { structuredData } from '@/lib/server/seo';

/**
 * JSON for inside a `<script>`: every "<" written as <, so nothing in the data can close the
 * script or open another (JSON.parse reads it back unchanged).
 */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * The front door's structured data (A6-03): an Organization and a WebSite, as JSON-LD. The root
 * layout renders it with the request's path and CSP nonce (proxy.ts); on any other page, or with no
 * nonce (the CSP would refuse the script), it renders nothing. A server component.
 */
export function SiteJsonLd({
  path,
  nonce,
  base,
}: {
  path: string | null;
  nonce: string | null;
  base: URL;
}) {
  if (path !== '/' || !nonce) return null;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      // JSON-LD is data, not markup: React would escape it as text. Escaped by jsonForScript.
      // biome-ignore lint/security/noDangerouslySetInnerHtml: our own data, every "<" escaped
      dangerouslySetInnerHTML={{ __html: jsonForScript(structuredData(base)) }}
    />
  );
}
