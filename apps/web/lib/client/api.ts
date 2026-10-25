import { auth, documentErrors, errors, offerErrors } from '@universityflow/content';

/**
 * Calls the app's own API from the browser. Errors come back as codes; this turns each into the
 * learner-facing sentence from packages/content.
 *
 * Every page that calls the API loads this, sign-in included, so it imports only the error
 * tables (`offerErrors`, not all of `offers`): A4-10.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string | null,
    /** The refused value's path in what was sent (`description`, `advert.text`), when the API says (A2-52). */
    readonly field: string | null = null,
  ) {
    super(code);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: {
      ...(json === undefined ? {} : { 'content-type': 'application/json' }),
      ...(rest.headers ?? {}),
    },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      field?: unknown;
    };
    throw new ApiError(
      response.status,
      body.error ?? 'server',
      body.detail ?? null,
      typeof body.field === 'string' ? body.field : null,
    );
  }
  return (await response.json()) as T;
}

/** The sentence to show for an error. */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return errors.generic;
  switch (error.code) {
    case 'phone':
      return auth.errors.phone;
    case 'pin':
      return auth.errors.pin;
    case 'expired':
      return auth.errors.expired;
    case 'rate-limited':
      return auth.errors.rateLimited;
    case 'pin-locked':
      return auth.errors.pinLocked;
    case 'signed-out':
      return errors.signedOut;
    case 'consent':
      return errors.consent;
    case 'consent-outdated':
      return error.detail === 'university-documents'
        ? errors.consentOutdatedDocuments
        : errors.consentOutdated;
    case 'sms-unavailable':
      return errors.smsUnavailable;
    case 'guardian-opted-out':
      return errors.guardianOptedOut;
    case 'state':
      if (error.detail === 'too-young') return errors.tooYoung;
      if (error.detail === 'report-above-grade') return errors.reportAboveGrade;
      return error.detail && error.detail in offerErrors
        ? offerErrors[error.detail as keyof typeof offerErrors]
        : errors.generic;
    case 'upload':
      return error.detail && error.detail in documentErrors
        ? documentErrors[error.detail as keyof typeof documentErrors]
        : errors.generic;
    default:
      return errors.generic;
  }
}

/** A South African date, e.g. "30 Sept 2026". */
export function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Johannesburg',
  });
}
