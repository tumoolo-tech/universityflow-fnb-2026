import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CvEngineError,
  cvProfileJsonSchema,
  MemoryCvEngine,
  type ProblemCode,
} from '@universityflow/cv';

/**
 * A local fake of Mmereko's partner API, as its shared contract describes it
 * (packages/cv/contract/README.md and openapi.json, vendored from Mmereko), on 127.0.0.1 and a
 * port the system picks:
 *
 * - `POST /oauth/token`: client credentials by HTTP Basic or in the form; `200 {access_token,
 *   token_type: "Bearer", expires_in: 600, scope}` with `Cache-Control: no-store`;
 *   `401 invalid_client`, `400 unsupported_grant_type`, `400 invalid_scope`.
 * - Every other call: a bearer token, or `401 invalid_token` with `WWW-Authenticate: Bearer`.
 * - `POST /cv-drafts`, `/tailorings` (`202`, `Location`), `/ats-scans` (`200`): `Idempotency-Key`
 *   required; a replay answers the first answer with `Idempotent-Replayed: true`.
 * - `GET /jobs/{id}` and `POST /jobs/{id}/ack` need `X-Learner-Ref` (another learner's job is
 *   `404`); an ack while a job runs is `409 job_not_finished`.
 * - `DELETE /learners/{ref}` (`202`, `Location`), `GET /deletions/{id}`,
 *   `GET /learners/{ref}/export`, `GET /schema/cv-profile.json`, `GET /health`.
 * - Problems are `application/problem+json` with `type`, `title`, `status`, `code`, `retryable`
 *   and `problems` (paths and codes), never echoing input; `X-Sandbox-Simulate: 429 | 500`.
 *
 * Its logic is `MemoryCvEngine`, so it refuses what the contract says Mmereko refuses. Tests only:
 * synthetic data only.
 */

export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: string;
}

export interface FakeMmerekoOptions {
  readonly clientId: string;
  /** The client secrets Mmereko accepts now (two during a rotation). */
  readonly secrets: ReadonlyArray<string>;
  readonly webhookSecret: string;
  /** Token lifetime in seconds (600). */
  readonly tokenSeconds?: number;
}

const BASE = '/partner/v1';
const PDF_PREFIX = 'https://cv-engine.invalid/pdf/';
const SCOPES = ['cv:write', 'cv:read', 'ats:scan', 'learner:read', 'learner:delete'];

export class FakeMmereko {
  readonly engine: MemoryCvEngine;
  readonly requests: RecordedRequest[] = [];
  readonly #server: Server;
  readonly #options: FakeMmerekoOptions;
  readonly #tokens = new Map<string, number>();
  readonly #replays = new Map<string, { status: number; body: unknown }>();
  #secrets: ReadonlyArray<string>;
  #failures: Array<{ status: number; code: ProblemCode; retryAfter?: string; delayMs?: number }> =
    [];
  #headers: Record<string, string> = {};
  tokenRequests = 0;
  url = '';

  constructor(options: FakeMmerekoOptions) {
    this.#options = options;
    this.#secrets = options.secrets;
    this.engine = new MemoryCvEngine({ webhookSecret: options.webhookSecret });
    this.#server = createServer((req, res) => {
      void this.#handle(req, res);
    });
  }

  async start(): Promise<this> {
    await new Promise<void>((resolve) => this.#server.listen(0, '127.0.0.1', resolve));
    const { port } = this.#server.address() as AddressInfo;
    this.url = `http://127.0.0.1:${port}${BASE}`;
    return this;
  }

  async stop(): Promise<void> {
    this.#server.closeAllConnections();
    await new Promise<void>((resolve) => this.#server.close(() => resolve()));
  }

  /** The next request answers this problem (or, with `delayMs`, answers late). */
  failNext(status: number, code: ProblemCode, retryAfter?: string, delayMs?: number): void {
    this.#failures.push({
      status,
      code,
      ...(retryAfter ? { retryAfter } : {}),
      ...(delayMs ? { delayMs } : {}),
    });
  }

  /** Accept only these client secrets from now on (a rotation). */
  setSecrets(secrets: ReadonlyArray<string>): void {
    this.#secrets = secrets;
  }

  /** Revoke every token issued (the next call gets a 401). */
  revokeTokens(): void {
    this.#tokens.clear();
  }

  /** Extra headers on every answer (Deprecation, Sunset). */
  answerWith(headers: Record<string, string>): void {
    this.#headers = headers;
  }

  async complete(jobId: string): Promise<void> {
    await this.engine.complete(jobId);
  }

  #send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, {
      ...this.#headers,
      ...(body === undefined
        ? {}
        : { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' }),
      ...headers,
    });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  }

  #problem(res: ServerResponse, error: CvEngineError, headers: Record<string, string> = {}) {
    this.#send(
      res,
      error.status || 500,
      {
        type: `https://mmereko.app/problems/partner/${error.code}`,
        title: error.code,
        status: error.status,
        code: error.code,
        retryable: error.retryable,
        ...(error.problems.length > 0 ? { problems: error.problems } : {}),
      },
      {
        ...(error.retryAfterMs
          ? { 'retry-after': String(Math.ceil(error.retryAfterMs / 1000)) }
          : {}),
        ...(error.code === 'invalid_token' ? { 'www-authenticate': 'Bearer' } : {}),
        ...headers,
      },
    );
  }

  async #body(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString('utf8');
  }

  #authorised(req: IncomingMessage): boolean {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const until = this.#tokens.get(token);
    return until !== undefined && until > Date.now();
  }

  #publicJob<T extends { result: { pdf: { url: string } } | null }>(job: T): T {
    if (!job.result) return job;
    const id = job.result.pdf.url.slice(PDF_PREFIX.length);
    return {
      ...job,
      result: { ...job.result, pdf: { ...job.result.pdf, url: `${this.url}/pdf/${id}` } },
    };
  }

  #token(req: IncomingMessage, res: ServerResponse, body: string) {
    this.tokenRequests += 1;
    const form = new URLSearchParams(body);
    const basic = req.headers.authorization?.startsWith('Basic ')
      ? Buffer.from(req.headers.authorization.slice(6), 'base64').toString('utf8').split(':')
      : null;
    const clientId = decodeURIComponent(basic?.[0] ?? form.get('client_id') ?? '');
    const secret = decodeURIComponent(basic?.[1] ?? form.get('client_secret') ?? '');
    const oauth = (status: number, code: ProblemCode, error: string) =>
      this.#send(res, status, {
        type: `https://mmereko.app/problems/partner/${code}`,
        title: code,
        status,
        code,
        retryable: false,
        error,
      });
    if (clientId !== this.#options.clientId || !this.#secrets.includes(secret)) {
      oauth(401, 'invalid_client', 'invalid_client');
      return;
    }
    if (form.get('grant_type') !== 'client_credentials') {
      oauth(400, 'unsupported_grant_type', 'unsupported_grant_type');
      return;
    }
    const asked = (form.get('scope') ?? '').split(' ').filter(Boolean);
    if (asked.some((s) => !SCOPES.includes(s))) {
      oauth(400, 'invalid_scope', 'invalid_scope');
      return;
    }
    const token = `tok-${randomUUID()}`;
    const seconds = this.#options.tokenSeconds ?? 600;
    this.#tokens.set(token, Date.now() + seconds * 1000);
    this.#send(
      res,
      200,
      {
        access_token: token,
        token_type: 'Bearer',
        expires_in: seconds,
        scope: (asked.length > 0 ? asked : SCOPES).join(' '),
      },
      { 'cache-control': 'no-store' },
    );
  }

  async #handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await this.#body(req);
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const path = url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) : url.pathname;
    this.requests.push({
      method: req.method ?? 'GET',
      path,
      headers: {
        authorization: req.headers.authorization,
        'idempotency-key': req.headers['idempotency-key'] as string | undefined,
        'x-learner-ref': req.headers['x-learner-ref'] as string | undefined,
        'content-type': req.headers['content-type'],
      },
      body,
    });
    try {
      const failure = this.#failures.shift();
      if (failure?.delayMs) await new Promise((r) => setTimeout(r, failure.delayMs));
      if (failure && failure.status > 0) {
        const retryable = failure.status >= 500 || failure.status === 429;
        this.#problem(
          res,
          new CvEngineError(failure.code, failure.status, retryable),
          failure.retryAfter ? { 'retry-after': failure.retryAfter } : {},
        );
        return;
      }
      const simulate = req.headers['x-sandbox-simulate'];
      if (simulate === '429') {
        this.#problem(res, new CvEngineError('rate_limited', 429, true, { retryAfterMs: 30_000 }));
        return;
      }
      if (simulate === '500') {
        this.#problem(res, new CvEngineError('server_error', 500, true));
        return;
      }

      if (req.method === 'GET' && path === '/health') {
        this.#send(res, 200, {
          status: 'ok',
          service: 'mmereko-partner',
          apiVersion: 'v1',
          version: 'fake',
          sandbox: true,
        });
        return;
      }
      if (req.method === 'GET' && path === '/schema/cv-profile.json') {
        this.#send(res, 200, cvProfileJsonSchema());
        return;
      }
      if (req.method === 'POST' && path === '/oauth/token') {
        this.#token(req, res, body);
        return;
      }
      if (!this.#authorised(req)) throw new CvEngineError('invalid_token', 401, false);
      if (path.startsWith('/pdf/')) {
        const bytes = await this.engine.fetchPdf(`${PDF_PREFIX}${path.slice('/pdf/'.length)}`);
        res.writeHead(200, {
          'content-type': 'application/pdf',
          'content-length': String(bytes.byteLength),
        });
        res.end(Buffer.from(bytes));
        return;
      }
      const key = req.headers['idempotency-key'] as string | undefined;
      const learner = req.headers['x-learner-ref'] as string | undefined;
      const json = () => {
        try {
          return JSON.parse(body);
        } catch {
          throw new CvEngineError('invalid_json', 400, false);
        }
      };
      /** A POST's answer, kept under its key so a replay gets it again. */
      const answer = async (status: number, make: () => Promise<unknown>, headers = {}) => {
        const replay = key ? this.#replays.get(`${path}:${key}:${body}`) : undefined;
        if (replay) {
          this.#send(res, replay.status, replay.body, { 'idempotent-replayed': 'true' });
          return;
        }
        const result = await make();
        if (key) this.#replays.set(`${path}:${key}:${body}`, { status, body: result });
        this.#send(res, status, result, headers);
      };

      const idIn = (method: string, pattern: RegExp): string | null => {
        const found = req.method === method ? pattern.exec(path) : null;
        return found?.[1] ? decodeURIComponent(found[1]) : null;
      };
      const job = idIn('GET', /^\/jobs\/([^/]+)$/);
      const ack = idIn('POST', /^\/jobs\/([^/]+)\/ack$/);
      const deleted = idIn('DELETE', /^\/learners\/([^/]+)$/);
      const deletion = idIn('GET', /^\/deletions\/([^/]+)$/);
      const exported = idIn('GET', /^\/learners\/([^/]+)\/export$/);
      if (req.method === 'POST' && path === '/cv-drafts') {
        await answer(202, async () => this.engine.createDraft(json(), key as string));
      } else if (req.method === 'POST' && path === '/tailorings') {
        await answer(202, async () => this.engine.tailor(json(), key as string));
      } else if (req.method === 'POST' && path === '/ats-scans') {
        await answer(200, async () => {
          if (!key) throw new CvEngineError('idempotency_key_required', 400, false);
          return this.engine.atsScan(json());
        });
      } else if (job) {
        this.#send(res, 200, this.#publicJob(await this.engine.getJob(job, learner ?? '')));
      } else if (ack) {
        if (!key) throw new CvEngineError('idempotency_key_required', 400, false);
        await this.engine.ack(ack, learner ?? '');
        this.#send(res, 204);
      } else if (deleted) {
        const result = await this.engine.deleteLearner(deleted);
        this.#send(res, 202, result, { location: `${BASE}/deletions/${result.deletionId}` });
      } else if (deletion) {
        this.#send(res, 200, await this.engine.getDeletion(deletion));
      } else if (exported) {
        this.#send(res, 200, await this.engine.exportLearner(exported));
      } else {
        throw new CvEngineError('not_found', 404, false);
      }
    } catch (error) {
      this.#problem(
        res,
        error instanceof CvEngineError ? error : new CvEngineError('server_error', 500, true),
      );
    }
  }
}
