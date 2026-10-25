import { createNdjsonDecoder, createNdjsonParser, NdjsonError } from '../lib/ndjson';
import type { ChatEvent } from '../lib/types';
import { utf8 } from '../test-utils/utf8';

describe('the NDJSON parser (the chat stream)', () => {
  it('returns each complete line, in order', () => {
    const parser = createNdjsonParser<ChatEvent>();
    expect(parser.push('{"type":"text","delta":"Hi"}\n{"type":"done","crisis":false}\n')).toEqual([
      { type: 'text', delta: 'Hi' },
      { type: 'done', crisis: false },
    ]);
    expect(parser.end()).toEqual([]);
  });

  it('holds a partial line until its newline arrives, across any split', () => {
    const line = '{"type":"text","delta":"Sawubona, how are you?"}\n';
    for (let cut = 1; cut < line.length; cut++) {
      const parser = createNdjsonParser<ChatEvent>();
      expect(parser.push(line.slice(0, cut))).toEqual([]);
      expect(parser.push(line.slice(cut))).toEqual([
        { type: 'text', delta: 'Sawubona, how are you?' },
      ]);
    }
  });

  it('reassembles one event split over many chunks, and several events in one chunk', () => {
    const parser = createNdjsonParser<ChatEvent>();
    const out = [
      ...parser.push('{"type":"te'),
      ...parser.push('xt","del'),
      ...parser.push('ta":"a"}\n{"type":"text","delta":"b"}\n{"type":'),
      ...parser.push('"done","crisis":true}'),
      ...parser.end(),
    ];
    expect(out).toEqual([
      { type: 'text', delta: 'a' },
      { type: 'text', delta: 'b' },
      { type: 'done', crisis: true },
    ]);
  });

  it('passes an error event through like any other', () => {
    const parser = createNdjsonParser<ChatEvent>();
    expect(parser.push('{"type":"text","delta":"x"}\n{"type":"error"}\n')).toEqual([
      { type: 'text', delta: 'x' },
      { type: 'error' },
    ]);
  });

  it('skips blank lines and CRLF endings', () => {
    const parser = createNdjsonParser<ChatEvent>();
    expect(parser.push('\n\r\n{"type":"error"}\r\n\n')).toEqual([{ type: 'error' }]);
  });

  it('refuses a malformed line without echoing it (it may be a learner’s words)', () => {
    const parser = createNdjsonParser<ChatEvent>();
    expect(() => parser.push('{"type":"text","delta":"my secret\n')).toThrow(NdjsonError);
    try {
      createNdjsonParser().push('not json my secret\n');
    } catch (e) {
      expect((e as Error).message).not.toContain('secret');
    }
  });

  it('decodes UTF-8 split inside a character', () => {
    const bytes = utf8('{"type":"text","delta":"you’re ✓"}\n');
    const decoder = createNdjsonDecoder<ChatEvent>();
    const out: ChatEvent[] = [];
    for (const byte of bytes) out.push(...decoder.push(new Uint8Array([byte])));
    out.push(...decoder.end());
    expect(out).toEqual([{ type: 'text', delta: 'you’re ✓' }]);
  });
});
