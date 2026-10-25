import 'server-only';

/** Thrown when a body runs past its cap. */
export class BodyTooLargeError extends Error {
  override readonly name = 'BodyTooLargeError';
}

/**
 * A request's or response's body, read only up to `max` bytes (CV-A5 A5-16, A5-19): a declared
 * length over the cap is refused before reading, and a body without one (chunked) is counted as
 * it streams and cancelled at the cap, so a sender can't make the server buffer more than it will
 * keep.
 */
export async function readCapped(
  message: { readonly headers: Headers; readonly body: ReadableStream<Uint8Array> | null },
  max: number,
): Promise<Uint8Array> {
  const declared = Number(message.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declared) && declared > max) {
    await message.body?.cancel().catch(() => undefined);
    throw new BodyTooLargeError();
  }
  if (!message.body) return new Uint8Array(0);
  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/**
 * A webhook's body as text, read up to `max` bytes, or null when it is longer (A5-19). Not valid
 * UTF-8 is replaced, as `Request.text()` does, so a signature over it simply fails.
 */
export async function readCappedText(request: Request, max: number): Promise<string | null> {
  try {
    return new TextDecoder().decode(await readCapped(request, max));
  } catch (error) {
    if (error instanceof BodyTooLargeError) return null;
    throw error;
  }
}
