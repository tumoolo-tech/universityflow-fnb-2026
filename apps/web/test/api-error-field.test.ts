import { InvalidStateError, PersonalNumberError } from '@universityflow/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api } from '../lib/client/api';
import { handler } from '../lib/server/http';

/**
 * Audit CV-A2 A2-52 (WCAG 3.3.1), the web's side: a refusal names the problem and, when the
 * check that refused it knows, the field it is about, as that value's path in the request body
 * (`description`, `advert.text`, `evidence.0.label`), never the value itself. The page then puts
 * the message on that field (`aria-invalid` and the error under it). Synthetic values only.
 */

const request = () => new Request('http://localhost/api/synthetic', { method: 'POST' });
const answer = async (error: unknown) => {
  const response = await handler(async (_: Request) => {
    throw error;
  })(request());
  return { status: response.status, body: await response.json() };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('a refusal names its field (A2-52)', () => {
  it('passes on the path of the refused value with the reason', async () => {
    expect(
      await answer(Object.assign(new PersonalNumberError(), { field: 'description' })),
    ).toEqual({
      status: 409,
      body: { error: 'state', detail: 'personal-number', field: 'description' },
    });
    expect(
      await answer(Object.assign(new PersonalNumberError(), { field: 'evidence.0.label' })),
    ).toEqual({
      status: 409,
      body: { error: 'state', detail: 'personal-number', field: 'evidence.0.label' },
    });
  });

  it('answers as before when the check doesn’t say which field', async () => {
    expect(await answer(new PersonalNumberError())).toEqual({
      status: 409,
      body: { error: 'state', detail: 'personal-number' },
    });
    expect(await answer(new InvalidStateError('synthetic'))).toEqual({
      status: 409,
      body: { error: 'state', detail: null },
    });
  });

  it('never echoes anything but a plain path: no value, no markup, nothing long', async () => {
    for (const field of ['<b>x</b>', 'description is wrong', 'a'.repeat(81), 'x.y.z.w.v', 7, '']) {
      const { body } = await answer(Object.assign(new PersonalNumberError(), { field }));
      expect(body).toEqual({ error: 'state', detail: 'personal-number' });
    }
  });

  it('the client keeps the field on its ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: 'state', detail: 'personal-number', field: 'advert.text' }),
            { status: 409 },
          ),
      ),
    );
    const error = await api('/api/synthetic', { method: 'POST' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).detail).toBe('personal-number');
    expect((error as ApiError).field).toBe('advert.text');
  });
});
