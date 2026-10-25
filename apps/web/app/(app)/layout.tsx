import { en } from '@universityflow/content';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PreviewNotice } from '@/components/preview-notice';
import { ReadAloudProvider } from '@/components/read-aloud';
import { getServices } from '@/lib/server/services';
import { readyStudent } from '@/lib/server/session';
import { NavLinks } from './nav';

export const dynamic = 'force-dynamic';

/**
 * Every signed-in page. A learner whose data can't be processed yet (no date of birth, or a
 * minor waiting for a guardian) is sent back to onboarding: hard rule 5 at the page level, on
 * top of the database's own check. Next renders this layout and its page in parallel, so every
 * page under it makes the same check itself (`readyStudent`, audit A1-10).
 *
 * On a phone, a header with a Menu button that opens the nav; from a laptop's width, a sidebar with
 * the nav grouped by stage (docs/design/README.md). One nav either way, so every link exists once.
 *
 * Read aloud is offered on every page under it only when the server has an ElevenLabs voice
 * (owner's choice of 2026-10-22); the key itself never leaves the server.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  await readyStudent();
  const { config, model, voice, cv } = await getServices();

  return (
    <div className="uf-app flex min-h-dvh flex-col lg:flex-row">
      <header className="uf-sidebar border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-sidebar lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-b-0">
        <NavLinks
          // My CV only while the server's switch is on and an engine makes it (UF_CV, D8).
          cvLabel={config.cv && cv ? en.cv.title : null}
          brand={
            <Link href="/home" className="uf-sidebar-brand">
              {en.app.name}
            </Link>
          }
        />
      </header>
      <div className="uf-app-column flex min-w-0 flex-1 flex-col">
        {config.catalogueDrafts || model.isSample ? (
          // Hidden on the chat, which says it under its composer instead (globals.css).
          <div className="uf-preview mx-auto w-full max-w-page px-4 pt-3 lg:px-6">
            <PreviewNotice drafts={config.catalogueDrafts} sample={model.isSample} />
          </div>
        ) : null}
        <main id="main" className="uf-app-main mx-auto w-full max-w-page flex-1 px-4 py-5 lg:px-6">
          <ReadAloudProvider available={voice !== null}>{children}</ReadAloudProvider>
        </main>
      </div>
    </div>
  );
}
