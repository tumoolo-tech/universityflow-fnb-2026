import { ApiError, errorMessage } from './api';

/**
 * The sentence for a My CV refusal: the CV routes give their reason as `detail` (or, for a daily
 * limit and an engine that couldn't answer, as the code), and its words are `cv.errors`, sent to
 * the page as props. Anything else is the app's usual sentence.
 */
export function cvErrorMessage(error: unknown, reasons: Readonly<Record<string, string>>): string {
  if (error instanceof ApiError) {
    if (error.detail && Object.hasOwn(reasons, error.detail)) return reasons[error.detail] ?? '';
    if (Object.hasOwn(reasons, error.code)) return reasons[error.code] ?? '';
  }
  return errorMessage(error);
}
