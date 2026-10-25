import type { NextConfig } from 'next';
import { buildCsp, CSP_HEADER, uploadOrigin } from './lib/csp';

/**
 * Security headers, carried over from tumo-olo. The Content-Security-Policy is not here for
 * pages: `proxy.ts` sets it with a fresh nonce per request. API routes, which the proxy skips,
 * get the nonce-free policy below, so every response carries exactly one CSP.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    // Camera stays allowed for this origin: students photograph their reports (Stage 1).
    value: 'camera=(self), microphone=(), geolocation=(), payment=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Dev only. Next treats `127.0.0.1` and `localhost` as different origins and answers 403 to
  // asset requests from the untrusted one, so the page renders but never hydrates (tumo-olo
  // gotcha 24).
  allowedDevOrigins: ['127.0.0.1'],

  // Workspace packages ship TypeScript source, not a build artifact.
  transpilePackages: [
    '@universityflow/admissions',
    '@universityflow/agent',
    '@universityflow/catalogue',
    '@universityflow/content',
    '@universityflow/db',
    '@universityflow/documents',
    '@universityflow/jobs',
    '@universityflow/messaging',
    '@universityflow/tokens',
    // Read aloud's Speech types and placeSpeech (Phase 5e-4).
    '@universityflow/ui',
  ],

  // Native and WebAssembly drivers stay outside the server bundle: the databases, and `sharp`
  // (report photos are resized before the AI reads them). Next lists `sharp` by default; it's
  // named here so the dependency is visible.
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'sharp'],

  // Next 16 writes AGENTS.md + CLAUDE.md into the app on `next dev`. The root CLAUDE.md is the
  // session context; a second one here would shadow it.
  agentRules: false,

  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/api/:path*',
        headers: [
          {
            key: CSP_HEADER,
            value: buildCsp({
              dev: process.env['NODE_ENV'] === 'development',
              uploadOrigin: uploadOrigin(process.env),
            }),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
