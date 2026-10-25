import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import { prepareForReading } from './images';
import { type ExtractedReport, extractedReportSchema } from './report';
import type { StoredFile } from './storage';
import type { UploadType } from './uploads';

/**
 * Reads a school report image or PDF into an `ExtractedReport`, behind an interface (D8).
 *
 * - `AnthropicReportReader`: Claude reads the document into a fixed schema (structured output).
 * - `SampleReportReader`: the local stand-in. With no AI connected it returns the same synthetic
 *   report every time, so the upload → confirm → results flow can be built and tested. The
 *   interface labels it as sample data, and the app refuses it in production.
 *
 * Either way the result is a draft: the learner confirms every value (hard rule 6).
 */

export interface ReportReader {
  /** True for the local stand-in, so the interface can say the values are a sample. */
  readonly isSample: boolean;
  read(file: StoredFile & { mimeType: UploadType }): Promise<ExtractedReport>;
}

export class ReaderUnavailableError extends Error {
  override readonly name = 'ReaderUnavailableError';
}

/** A synthetic Grade 11 report: plausible, and obviously nobody's. */
export const SAMPLE_REPORT: ExtractedReport = {
  isSchoolReport: true,
  grade: 11,
  term: 'final',
  subjects: [
    { nameAsPrinted: 'isiZulu Home Language', percent: 74 },
    { nameAsPrinted: 'English First Additional Language', percent: 62 },
    { nameAsPrinted: 'Mathematics', percent: 58 },
    { nameAsPrinted: 'Physical Sciences', percent: 55 },
    { nameAsPrinted: 'Life Sciences', percent: 66 },
    { nameAsPrinted: 'Geography', percent: 61 },
    { nameAsPrinted: 'Life Orientation', percent: 80 },
  ],
  partlyUnreadable: false,
};

export class SampleReportReader implements ReportReader {
  readonly isSample = true;
  async read(): Promise<ExtractedReport> {
    return structuredClone(SAMPLE_REPORT);
  }
}

const INSTRUCTIONS = `You read South African school reports for a learner who will check every value you return.

Return only what is printed. For each subject row, give the subject name exactly as printed and the percentage printed for it. If a percentage is missing, cut off or too blurred to read with confidence, return null for it rather than guessing. Do not convert levels or symbols into percentages.

Do not return the learner's name, ID number, school name or any other personal detail: they are not part of the schema and must not appear anywhere in your output.

Set isSchoolReport to false if the document is not a school report. Set partlyUnreadable to true if any part of the subject table could not be read.`;

export class AnthropicReportReader implements ReportReader {
  readonly isSample = false;
  readonly #client: Anthropic;
  readonly #model: string;

  constructor(options: { client?: Anthropic; model: string }) {
    this.#client = options.client ?? new Anthropic();
    this.#model = options.model;
  }

  /**
   * Every failure becomes a `ReaderUnavailableError`: the API failing, a refusal, a response cut
   * off or off-schema, or an image that won't decode. The caller then marks the document failed
   * and the learner types their marks in. Nothing partial is ever returned as a draft, and the
   * error carries no part of the response (it may hold a learner's marks).
   */
  async read(file: StoredFile & { mimeType: UploadType }): Promise<ExtractedReport> {
    return readStructured(this.#client, this.#model, file, {
      system: INSTRUCTIONS,
      prompt: 'Read the subject table on this report.',
      schema: extractedReportSchema,
      what: 'report',
    });
  }
}

/**
 * Claude reads one document into a fixed schema (structured output), for every document type.
 * Every failure becomes a `ReaderUnavailableError` that carries no part of the response (it may
 * hold a learner's marks or details): the API failing, a refusal, a response cut off or
 * off-schema, or an image that won't decode. Nothing partial is ever returned.
 */
export async function readStructured<S extends z.ZodType>(
  client: Anthropic,
  model: string,
  file: StoredFile & { mimeType: UploadType },
  request: { system: string; prompt: string; schema: S; what: string },
): Promise<z.infer<S>> {
  const unreadable = () => new ReaderUnavailableError(`The ${request.what} could not be read`);
  try {
    const prepared = await prepareForReading({ bytes: file.bytes, mimeType: file.mimeType });
    const data = Buffer.from(prepared.bytes).toString('base64');
    const source =
      prepared.mimeType === 'application/pdf'
        ? ({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data },
          } as const)
        : ({
            type: 'image',
            source: { type: 'base64', media_type: prepared.mimeType, data },
          } as const);

    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      system: request.system,
      messages: [{ role: 'user', content: [source, { type: 'text', text: request.prompt }] }],
      // The SDK's helper is typed against zod/v4 without exactOptionalPropertyTypes; the schema
      // is the same Zod 4 object, so only the type needs bridging.
      output_config: {
        format: zodOutputFormat(request.schema as unknown as Parameters<typeof zodOutputFormat>[0]),
      },
    });

    if (response.stop_reason !== 'end_turn' || !response.parsed_output) throw unreadable();
    return request.schema.parse(response.parsed_output);
  } catch {
    throw unreadable();
  }
}
