import { privacyPage } from '@universityflow/content';
import Link from 'next/link';

/**
 * The link to the privacy policy beside every consent box (the launch standard). It opens in the
 * same tab: the consent page and onboarding are both there again with the browser's Back.
 * Imports only its own section of copy, so a client page that shows it stays small (A4-10).
 */
export function PrivacyLink() {
  return (
    <p>
      <Link href="/privacy" className="inline-flex min-h-11 items-center">
        {privacyPage.consentLink}
      </Link>
    </p>
  );
}
