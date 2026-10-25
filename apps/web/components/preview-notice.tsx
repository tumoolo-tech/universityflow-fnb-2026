import { chat, common } from '@universityflow/content';
import { Icon } from './icons';

/**
 * The preview notice on every signed-in page (never in production): one compact line, with the
 * full sentences behind "More". A native `details`, so it opens without JavaScript and tells
 * screen readers whether it is open.
 */
export function PreviewNotice({ drafts, sample }: { drafts: boolean; sample: boolean }) {
  const short = [drafts ? common.previewDrafts : null, sample ? common.previewSample : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <div role="note" className="rounded-md border-l-rule border-warning bg-warning-soft text-sm">
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 lg:min-h-9 [&::-webkit-details-marker]:hidden">
          <Icon name="alert" className="size-4 shrink-0 text-warning" />
          <span className="flex-1 font-medium">{short}</span>
          <span className="text-warning underline underline-offset-4">{common.more}</span>
        </summary>
        <div className="uf-reveal flex flex-col gap-1 px-3 pb-3">
          {drafts ? <p>{common.draftNotice}</p> : null}
          {sample ? <p>{chat.sampleModel}</p> : null}
        </div>
      </details>
    </div>
  );
}
