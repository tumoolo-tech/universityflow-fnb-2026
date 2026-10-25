import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Calls the app's route handlers the way Next would, with a real (embedded) database and the
 * local stand-ins behind them. Only Next's request scope (`cookies()`, `headers()`) is replaced,
 * by a small cookie jar per simulated browser.
 */

process.env['DATABASE_URL'] = 'pglite:memory';
process.env['UF_FILE_STORE_DIR'] = mkdtempSync(join(tmpdir(), 'uf-web-'));
process.env['UF_PROVIDERS'] = 'local';
process.env['UF_CATALOGUE_PREVIEW'] = '1';
delete process.env['ANTHROPIC_API_KEY'];
// No test ever calls ElevenLabs: Read aloud's tests hand the services the fake voice.
delete process.env['ELEVENLABS_API_KEY'];
delete process.env['ELEVENLABS_VOICE_ID'];
delete process.env['ELEVENLABS_MODEL_ID'];
// My plan maps' words switch is off unless a test file turns it on before the services start.
delete process.env['UF_MINDMAP_WORDS'];

const HOST = 'localhost:3000';

interface Scope {
  headers: Headers;
  jar: Map<string, string>;
}
let scope: Scope = { headers: new Headers(), jar: new Map() };

/** Use with: vi.mock('next/headers', async () => (await import('../test/harness')).nextHeaders) */
export const nextHeaders = {
  headers: async () => scope.headers,
  cookies: async () => ({
    get: (name: string) => (scope.jar.has(name) ? { name, value: scope.jar.get(name) } : undefined),
    set: (name: string, value: string) => {
      scope.jar.set(name, value);
    },
    delete: (name: string) => {
      scope.jar.delete(name);
    },
  }),
};

// Method syntax keeps parameters bivariant, so handlers with typed params fit.
type Handler = {
  call(request: Request, context: { params: Promise<Record<string, string>> }): Promise<Response>;
}['call'];

export interface CallOptions {
  method?: string;
  json?: unknown;
  body?: BodyInit;
  params?: Record<string, string>;
  /** Send a bearer token instead of the cookie (the mobile app). */
  bearer?: string;
  /** Pretend the request came from another site. */
  origin?: string | null;
  /** Extra headers. */
  headers?: Record<string, string>;
}

/**
 * A POST of `total` bytes sent chunked (no content-length), counting what the server pulled
 * (CV-A5 A5-19): a capped reader stops near its cap; one that reads to the end pulls it all.
 */
export function chunkedRequest(path: string, total: number) {
  const chunk = new Uint8Array(1024).fill(120);
  const read = { bytes: 0 };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (read.bytes >= total) {
        controller.close();
        return;
      }
      read.bytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
  });
  const request = new Request(`http://${HOST}${path}`, {
    method: 'POST',
    headers: { host: HOST },
    body,
    duplex: 'half',
  } as RequestInit);
  return { request, read };
}

/** One simulated browser: its own cookies. */
export class Browser {
  readonly jar = new Map<string, string>();

  /** Makes this browser the request scope, for rendering a server component (a page). */
  enter(): void {
    const headers = new Headers({ host: HOST });
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.set('cookie', cookie);
    scope = { headers, jar: this.jar };
  }

  async call(handler: Handler, path: string, options: CallOptions = {}) {
    const headers = new Headers({ host: HOST });
    const origin = options.origin === undefined ? `http://${HOST}` : options.origin;
    if (origin) headers.set('origin', origin);
    if (options.json !== undefined) headers.set('content-type', 'application/json');
    if (options.bearer) headers.set('authorization', `Bearer ${options.bearer}`);
    for (const [k, v] of Object.entries(options.headers ?? {})) headers.set(k, v);
    // A real browser sends a multipart body with its length; serialise it the same way.
    let body: BodyInit | null =
      options.json !== undefined ? JSON.stringify(options.json) : (options.body ?? null);
    if (body instanceof FormData) {
      const encoded = new Response(body);
      headers.set('content-type', encoded.headers.get('content-type') ?? '');
      body = new Uint8Array(await encoded.arrayBuffer());
      headers.set('content-length', String(body.byteLength));
    }
    const cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) headers.set('cookie', cookie);
    scope = { headers, jar: this.jar };
    const request = new Request(`http://${HOST}${path}`, {
      method: options.method ?? (options.json !== undefined || options.body ? 'POST' : 'GET'),
      headers,
      body,
    });
    const response = await handler(request, { params: Promise.resolve(options.params ?? {}) });
    return response;
  }

  async json<T = Record<string, unknown>>(
    handler: Handler,
    path: string,
    options: CallOptions = {},
  ) {
    const response = await this.call(handler, path, options);
    return { status: response.status, body: (await response.json()) as T };
  }
}
