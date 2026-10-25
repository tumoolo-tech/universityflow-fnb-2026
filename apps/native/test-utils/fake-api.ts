import { fetch } from 'expo/fetch';
import { utf8 } from './utf8';

/**
 * A fake of the web app's API behind the mocked `expo/fetch`: each route answers with a status
 * and JSON, or with chunks of a stream (for /api/chat). Every call is recorded with its headers
 * and body so tests can check what the app sent.
 */

export interface Reply {
  readonly status?: number;
  readonly json?: unknown;
  /** Stream chunks, each delivered as one read. */
  readonly chunks?: ReadonlyArray<string>;
  /** A binary body (Read aloud's audio). */
  readonly bytes?: Uint8Array;
}

export interface Call {
  readonly key: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  /** A JSON body, parsed. */
  readonly body: unknown;
  /** A body sent as bytes (a multipart upload). */
  readonly bytes: Uint8Array | null;
  readonly credentials: string | undefined;
}

type Route = Reply | ((call: Call) => Reply);

function response(reply: Reply) {
  const status = reply.status ?? 200;
  const chunks = (reply.chunks ?? []).map(utf8);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => reply.json ?? {},
    arrayBuffer: async () => {
      const bytes = reply.bytes ?? new Uint8Array();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
    body: {
      getReader() {
        let i = 0;
        return {
          read: async () =>
            i < chunks.length
              ? { value: chunks[i++], done: false }
              : { value: undefined, done: true },
        };
      },
    },
  };
}

export function serve(routes: Record<string, Route>): Call[] {
  const calls: Call[] = [];
  (fetch as jest.Mock).mockImplementation(
    async (
      url: string,
      init: {
        method?: string;
        headers?: Record<string, string>;
        body?: string | Uint8Array;
        credentials?: string;
      } = {},
    ) => {
      const path = url.replace(/^https?:\/\/[^/]+/, '');
      const call: Call = {
        key: `${init.method ?? 'GET'} ${path}`,
        url,
        headers: init.headers ?? {},
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
        bytes: init.body instanceof Uint8Array ? init.body : null,
        credentials: init.credentials,
      };
      calls.push(call);
      const route = routes[call.key];
      if (!route) return response({ status: 404, json: { error: 'not-found', detail: null } });
      return response(typeof route === 'function' ? route(call) : route);
    },
  );
  return calls;
}

/** NDJSON lines for a chat reply. */
export const ndjson = (...events: unknown[]) =>
  events.map((e) => `${JSON.stringify(e)}\n`).join('');
