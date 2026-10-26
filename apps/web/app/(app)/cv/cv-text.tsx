import { type CvInline, cvTextBlocks } from '@universityflow/ui';
import { Fragment, type ReactNode } from 'react';
import { panelLook } from '@/components/ui';

/**
 * The CV's text in the preview as real structure (audit CV-A2, A2-47): its name, sections and
 * entries as headings under the preview's own h2 (h3, h4, h5), its bullets as a list, the rest as
 * paragraphs, so a screen reader reads headings and lists, never "number sign". React elements
 * only, never `dangerouslySetInnerHTML`: the text is always text, and a link only a safe https one
 * (`cvTextBlocks`, packages/ui).
 */

const HEADINGS = ['h3', 'h4', 'h5'] as const;

function runs(content: ReadonlyArray<CvInline>): ReactNode[] {
  return content.map((run, i) => {
    // The runs never reorder: their place is their key.
    const key = `${run.kind}-${i}`;
    if (run.kind === 'text') return run.text;
    if (run.kind === 'strong') return <strong key={key}>{runs(run.children)}</strong>;
    if (run.kind === 'em') return <em key={key}>{runs(run.children)}</em>;
    return (
      <a key={key} href={run.url} rel="noopener noreferrer nofollow" className="underline">
        {runs(run.children)}
      </a>
    );
  });
}

export function CvText({ markdown }: { markdown: string | null }) {
  return (
    <div className={`${panelLook} flex flex-col gap-2 p-4`}>
      {cvTextBlocks(markdown).map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === 'heading') {
          const Heading = HEADINGS[block.level - 1] ?? 'h5';
          return (
            <Heading key={key} className={block.level === 1 ? 'text-lg font-bold' : 'font-bold'}>
              {runs(block.content)}
            </Heading>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul key={key} className="list-disc pl-5">
              {block.items.map((item, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the CV's lines never reorder.
                <li key={j}>{runs(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key}>
            {block.lines.map((line, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the CV's lines never reorder.
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {runs(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
