/**
 * A buffered parser for newline-delimited JSON, the shape /api/chat streams its reply in. A
 * network chunk can end anywhere, mid-line or mid-character, so text is held until a newline
 * completes it. Pure, so it is tested on its own.
 */

/** Installed globally by Expo's runtime (expo/src/winter); typed here, as the app has no DOM lib. */
declare const TextDecoder: new () => {
  decode(input?: Uint8Array, options?: { stream?: boolean }): string;
};

export class NdjsonError extends Error {
  override readonly name = 'NdjsonError';
}

export interface NdjsonParser<T> {
  /** Feed decoded text; returns every value whose line is now complete. */
  push(text: string): T[];
  /** The stream ended: returns the last value if its line had no trailing newline. */
  end(): T[];
}

function parseLine<T>(line: string): T[] {
  const trimmed = line.trim();
  if (!trimmed) return [];
  try {
    return [JSON.parse(trimmed) as T];
  } catch {
    // The line's content is not echoed: it may be a learner's words (hard rule 4).
    throw new NdjsonError('A line of the stream was not valid JSON.');
  }
}

export function createNdjsonParser<T>(): NdjsonParser<T> {
  let buffer = '';
  return {
    push(text) {
      buffer += text;
      const out: T[] = [];
      let newline = buffer.indexOf('\n');
      while (newline >= 0) {
        out.push(...parseLine<T>(buffer.slice(0, newline)));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
      return out;
    },
    end() {
      const rest = buffer;
      buffer = '';
      return parseLine<T>(rest);
    },
  };
}

/** Bytes in, values out: decodes UTF-8 across chunk boundaries, then splits lines. */
export function createNdjsonDecoder<T>() {
  const decoder = new TextDecoder();
  const parser = createNdjsonParser<T>();
  return {
    push: (bytes: Uint8Array) => parser.push(decoder.decode(bytes, { stream: true })),
    end: () => [...parser.push(decoder.decode()), ...parser.end()],
  };
}
