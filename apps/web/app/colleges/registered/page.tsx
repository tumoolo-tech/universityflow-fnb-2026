import { registrationCheck } from '@universityflow/catalogue';
import { colleges as words } from '@universityflow/content';
import type { Metadata } from 'next';
import { colleges } from '@/lib/server/colleges';
import { CollegeRegistered, MAX_QUERY } from './college-registered';

export const metadata: Metadata = {
  title: words.check.title,
  description: words.check.lead,
};

/**
 * "Is this college registered?" (planning.md §19.1): open to anyone, no sign-in, and it keeps
 * nothing about the visitor. A plain GET form (`?name=`), so it works before any JavaScript and
 * the page is a server component with none of its own. The check is the catalogue's
 * `registrationCheck`: a whole name on DHET's list, or nothing (never a false yes); not found is
 * a plain warning with DHET's own links. While nobody has verified our copy of DHET's list,
 * production shows "can't check yet" rather than calling every college unlisted.
 */
export default async function CollegeRegisteredPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = (await searchParams)['name'];
  const query = (Array.isArray(asked) ? asked[0] : asked)?.slice(0, MAX_QUERY) ?? null;
  const view = await colleges();
  const check = query === null ? null : registrationCheck(view, query);
  return <CollegeRegistered view={view} query={query} check={check} />;
}
