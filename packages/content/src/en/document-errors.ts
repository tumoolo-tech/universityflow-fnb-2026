/**
 * `en.documents.errors`, in a module of its own: the browser's API client
 * (apps/web/lib/client/api.ts) carries these to every page that calls the API, sign-in included,
 * and the rest of `documents` belongs only on the documents pages.
 */
export const documentErrors = {
  empty: 'That file is empty.',
  'too-large': 'That file is bigger than 10 MB. Try a smaller photo.',
  'unsupported-type': 'We can read JPG, PNG, WebP and PDF files.',
  'not-received': 'Your file didn’t finish uploading. Check your connection and try again.',
  unreadable: 'We couldn’t read that report. You can type your marks in instead.',
} as const;
