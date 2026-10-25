import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_IMAGE_EDGE } from './images';
import { AnthropicReportReader, ReaderUnavailableError, SAMPLE_REPORT } from './reader';

/**
 * A1-07: `AnthropicReportReader` against a fake Anthropic API. The client is the real SDK
 * (so its request building and structured-output parsing are exercised too); only `fetch` is
 * replaced. No network, no key. Every report here is synthetic.
 */

const MODEL = 'claude-test-model';

interface Captured {
  url: string;
  body: Record<string, unknown>;
}

type Reply = { status?: number; body: unknown } | Error;

function fakeApi(...replies: Reply[]) {
  const requests: Captured[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    const reply = replies.shift();
    if (!reply) throw new Error('No more fake replies');
    if (reply instanceof Error) throw reply;
    return new Response(JSON.stringify(reply.body), {
      status: reply.status ?? 200,
      headers: { 'content-type': 'application/json', 'request-id': 'req_test' },
    });
  };
  const client = new Anthropic({ apiKey: 'test-key', fetch, maxRetries: 0 });
  return { client, requests };
}

function message(text: string, stopReason = 'end_turn') {
  return {
    body: {
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: MODEL,
      content: [{ type: 'text', text }],
      stop_reason: stopReason,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    },
  };
}

const PDF = new TextEncoder().encode('%PDF-1.7\nsynthetic report\n%%EOF');
const pdfFile = { bytes: PDF, mimeType: 'application/pdf' as const };

async function bigPhoto(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: 5000, height: 4000, channels: 3, background: '#f0ecdc' } })
      .jpeg()
      .withExif({ IFD0: { Make: 'SyntheticCam' } })
      .toBuffer(),
  );
}

let consoleSpies: ReturnType<typeof vi.spyOn>[] = [];
beforeEach(() => {
  consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
});
afterEach(() => {
  // Hard rule 4: the reader logs nothing, on success or failure (a report holds a learner's marks).
  for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('AnthropicReportReader: the request', () => {
  it('sends a PDF as a document block, with the configured model and a fixed schema', async () => {
    const { client, requests } = fakeApi(message(JSON.stringify(SAMPLE_REPORT)));
    const reader = new AnthropicReportReader({ client, model: MODEL });

    expect(reader.isSample).toBe(false);
    expect(await reader.read(pdfFile)).toEqual(SAMPLE_REPORT);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.url).toMatch(/\/v1\/messages$/);
    const body = request?.body as {
      model: string;
      max_tokens: number;
      system: string;
      messages: Array<{ role: string; content: Array<Record<string, unknown>> }>;
      output_config: { format: { type: string; schema: Record<string, unknown> } };
    };
    expect(body.model).toBe(MODEL);
    expect(body.max_tokens).toBeGreaterThan(0);
    // The instructions forbid personal details in the output.
    expect(body.system).toMatch(/Do not return the learner's name, ID number, school name/);

    const content = body.messages[0]?.content ?? [];
    expect(body.messages).toHaveLength(1);
    expect(content[0]).toEqual({
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: Buffer.from(PDF).toString('base64'),
      },
    });
    expect(content[1]).toMatchObject({ type: 'text' });

    // Structured output against the extraction schema, with no room for extra fields.
    const { format } = body.output_config;
    expect(format.type).toBe('json_schema');
    expect(format.schema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: expect.arrayContaining(['isSchoolReport', 'grade', 'term', 'subjects']),
    });
    expect(Object.keys(format.schema['properties'] as object).sort()).toEqual(
      ['grade', 'isSchoolReport', 'partlyUnreadable', 'subjects', 'term'].sort(),
    );
    // Nothing in the request's shape invites a name or ID number back.
    expect(JSON.stringify(format.schema)).not.toMatch(/name"|idNumber|school"/i);
  });

  it('sends a photo resized, as JPEG, with its metadata gone (A1-09)', async () => {
    const { client, requests } = fakeApi(message(JSON.stringify(SAMPLE_REPORT)));
    const reader = new AnthropicReportReader({ client, model: MODEL });
    const photo = await bigPhoto();

    await reader.read({ bytes: photo, mimeType: 'image/jpeg' });

    const body = requests[0]?.body as {
      messages: Array<{ content: Array<{ type: string; source: Record<string, string> }> }>;
    };
    const block = body.messages[0]?.content[0];
    expect(block?.type).toBe('image');
    expect(block?.source['media_type']).toBe('image/jpeg');
    const sent = Buffer.from(block?.source['data'] ?? '', 'base64');
    expect(sent.length).toBeLessThan(photo.length);
    const meta = await sharp(sent).metadata();
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(MAX_IMAGE_EDGE);
    expect(meta.width / meta.height).toBeCloseTo(5000 / 4000, 2);
    expect(meta.exif).toBeUndefined();
  });

  it('sends a PNG as image/jpeg after re-encoding', async () => {
    const { client, requests } = fakeApi(message(JSON.stringify(SAMPLE_REPORT)));
    const png = new Uint8Array(
      await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ffffff' } })
        .png()
        .toBuffer(),
    );
    await new AnthropicReportReader({ client, model: MODEL }).read({
      bytes: png,
      mimeType: 'image/png',
    });
    const body = requests[0]?.body as {
      messages: Array<{ content: Array<{ source: Record<string, string> }> }>;
    };
    expect(body.messages[0]?.content[0]?.source['media_type']).toBe('image/jpeg');
  });
});

describe('AnthropicReportReader: bad answers are refused, never turned into a draft', () => {
  const unreadable = async (reply: Reply) => {
    const { client } = fakeApi(reply);
    const reader = new AnthropicReportReader({ client, model: MODEL });
    const error = await reader.read(pdfFile).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReaderUnavailableError);
    return error as ReaderUnavailableError;
  };

  it('returns a valid reading, nulls and all', async () => {
    const reading = {
      ...SAMPLE_REPORT,
      subjects: [{ nameAsPrinted: 'Mathematics', percent: null }],
      partlyUnreadable: true,
    };
    const { client } = fakeApi(message(JSON.stringify(reading)));
    expect(await new AnthropicReportReader({ client, model: MODEL }).read(pdfFile)).toEqual(
      reading,
    );
  });

  it('a refusal', async () => {
    await unreadable(message('I can’t help with that.', 'refusal'));
  });

  it('a response that is not JSON', async () => {
    await unreadable(message('Here are the marks: Maths 58%'));
  });

  it('JSON that is off-schema (a percentage as text)', async () => {
    const offSchema = {
      ...SAMPLE_REPORT,
      subjects: [{ nameAsPrinted: 'Mathematics', percent: '58%' }],
    };
    const error = await unreadable(message(JSON.stringify(offSchema)));
    // The error never carries what the model read.
    expect(error.message).not.toMatch(/Mathematics|58/);
  });

  it('JSON missing a required field', async () => {
    const { partlyUnreadable: _, ...missing } = SAMPLE_REPORT;
    await unreadable(message(JSON.stringify(missing)));
  });

  it('a response cut off at max_tokens', async () => {
    const text = JSON.stringify(SAMPLE_REPORT);
    await unreadable(message(text.slice(0, text.length / 2), 'max_tokens'));
  });

  it('an empty response', async () => {
    const { client } = fakeApi({ body: { ...message('').body, content: [] } });
    await expect(
      new AnthropicReportReader({ client, model: MODEL }).read(pdfFile),
    ).rejects.toBeInstanceOf(ReaderUnavailableError);
  });

  it('the API failing (overloaded, rate-limited, bad request)', async () => {
    for (const status of [529, 429, 400, 500]) {
      await unreadable({
        status,
        body: { type: 'error', error: { type: 'api_error', message: 'synthetic failure' } },
      });
    }
  });

  it('the network failing', async () => {
    await unreadable(new TypeError('fetch failed'));
  });

  it('an image that will not decode, before any request is made', async () => {
    const { client, requests } = fakeApi(message(JSON.stringify(SAMPLE_REPORT)));
    const reader = new AnthropicReportReader({ client, model: MODEL });
    const broken = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 1, 2, 3, 4, 5]);
    await expect(reader.read({ bytes: broken, mimeType: 'image/jpeg' })).rejects.toBeInstanceOf(
      ReaderUnavailableError,
    );
    expect(requests).toHaveLength(0);
  });
});
