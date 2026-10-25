import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: en.errors.notFound };

/**
 * Any page that isn't there (and every `notFound()`): the app's own page, in its theme, with one
 * heading and a way home. Before it, Next's built-in page drew its own white box and styles over
 * the app's, which failed contrast (A2-64, docs/audits/results/DEMO-walk.md). A server component
 * that reads nothing about the visitor.
 */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex max-w-prose flex-col gap-6 px-5 py-16">
      <h1 className="text-3xl font-bold">{en.errors.notFound}</h1>
      <Link href="/" className="inline-flex min-h-11 items-center font-medium">
        {en.nav.home}
      </Link>
    </main>
  );
}
