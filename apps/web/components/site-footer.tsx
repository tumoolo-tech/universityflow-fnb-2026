import { en, OWNER_TO_FILL } from '@universityflow/content';
import Link from 'next/link';
import { cx, type PublicWidth, publicWidth } from '@/components/ui';

/**
 * A value the owner hasn't given yet ("Owner to fill: …") is marked, so it shows at a glance on
 * the page and in the footer; a real value is plain text.
 */
export function Fill({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cx(value.startsWith(OWNER_TO_FILL) && 'uf-fill', className)}>{value}</span>
  );
}

/**
 * The footer of every public page (/, /sign-in, /help, /consent, /privacy): the ECTA s43(1)
 * details (full legal name, legal status, registration number, physical address, phone, email)
 * and the privacy policy. A server component with no JavaScript. Held by
 * test/privacy-page.test.tsx.
 */
export function SiteFooter({ width = 'page' }: { width?: PublicWidth } = {}) {
  const p = en.privacyPage;
  const fields = Object.keys(p.businessLabels) as Array<keyof typeof p.businessLabels>;
  return (
    <footer className="uf-site-footer">
      {/* The page's own width (PublicPage), so the footer's edge lines up with the page's. */}
      <div className={cx('mx-auto flex flex-col gap-4 px-4 sm:px-6', publicWidth[width])}>
        <h2 className="text-base font-bold">{p.footer.label}</h2>
        <dl className="uf-site-footer-details">
          {fields.map((field) => (
            <div key={field}>
              <dt className="font-medium">{p.businessLabels[field]}</dt>
              <dd>
                <Fill value={p.business[field]} />
              </dd>
            </div>
          ))}
        </dl>
        <ul className="flex flex-wrap gap-x-6">
          <li>
            <Link href="/privacy" className="inline-flex min-h-11 items-center">
              {p.footer.privacyLink}
            </Link>
          </li>
          <li>
            <Link href="/help" className="inline-flex min-h-11 items-center">
              {p.footer.helpLink}
            </Link>
          </li>
          {/* The one public tool anyone can use without signing in (A6-05). */}
          <li>
            <Link href="/colleges/registered" className="inline-flex min-h-11 items-center">
              {en.colleges.checkLink}
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
