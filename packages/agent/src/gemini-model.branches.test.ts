import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeminiChatModel } from './gemini-model';
import { isModelUnavailable, ModelError, type ModelRequest } from './model';

/**
 * Gemini adapter edges beside gemini-model.test.ts: the default `fetch`, and an error event that
 * carries no code. A fake API only; the key is a placeholder. Synthetic only.
 */

const KEY = 'test-gemini-key-not-real';

const sse = (...chunks: unknown[]) =>
  new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\r\n\r\n`).join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });

function request(): ModelRequest {
  return {
    system: 'THE STABLE CHARTER',
    context: 'Per-request context.',
    history: [{ role: 'user', text: 'What can I study?' }],
    tools: [],
    onText: () => undefined,
    callTool: async () => ({ content: '{}', isError: false }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GeminiChatModel: edges', () => {
  it('uses the platform fetch when none is given, with the key in the header', async () => {
    const fetch = vi.fn(async () =>
      sse({ candidates: [{ content: { parts: [{ text: 'Hi' }] }, finishReason: 'STOP' }] }),
    );
    vi.stubGlobal('fetch', fetch);
    const model = new GeminiChatModel({ apiKey: KEY, model: 'gemini-test-model' });
    expect(await model.respond(request())).toEqual({ text: 'Hi', refused: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain(KEY);
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe(KEY);
  });

  it('counts an error event without a code as unavailable: another provider may answer', async () => {
    const fetch = (async () =>
      sse(
        { candidates: [{ content: { parts: [{ text: 'Half' }] } }] },
        { error: { message: 'internal' } },
      )) as typeof globalThis.fetch;
    const model = new GeminiChatModel({ apiKey: KEY, model: 'm', fetch });
    const error = await model.respond(request()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ModelError);
    expect(isModelUnavailable(error)).toBe(true);
    expect((error as Error).message).toBe('The Gemini API answered 500');
  });
});
