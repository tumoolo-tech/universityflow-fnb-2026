import { type CvInline, replyTextBlocks } from '@universityflow/ui';
import { Fragment, type ReactNode } from 'react';

/**
 * An AI reply as real structure (RT-02): paragraphs, bullet and numbered lists, bold words and
 * headings, read from the small Markdown subset the system prompt allows, so the learner never
 * sees "* **Howard College**". React elements only, never `dangerouslySetInnerHTML`: the reply is
 * always text (`replyTextBlocks`, packages/ui). Headings sit under the page's h1 and the
 * conversation's h2.
 */

const HEADINGS = ['h3', 'h4', 'h5'] as const;

function runs(content: ReadonlyArray<CvInline>): ReactNode[] {
  return content.map((run, i) => {
    // The runs never reorder: their place is their key.
    const key = `${run.kind}-${i}`;
    if (run.kind === 'text') return run.text;
    if (run.kind === 'strong') {
      return (
        <strong key={key} className="font-semibold">
          {runs(run.children)}
        </strong>
      );
    }
    // A reply has no links (`replyTextBlocks`); anything else is its words.
    if (run.kind === 'em') return <em key={key}>{runs(run.children)}</em>;
    return <Fragment key={key}>{runs(run.children)}</Fragment>;
  });
}

export function ReplyText({ text }: { text: string }) {
  return (
    <div className="uf-reply flex flex-col gap-3 leading-normal">
      {replyTextBlocks(text).map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === 'heading') {
          const Heading = HEADINGS[block.level - 1] ?? 'h5';
          return (
            <Heading key={key} className="text-lg font-semibold">
              {runs(block.content)}
            </Heading>
          );
        }
        if (block.kind === 'list') {
          const List = block.ordered ? 'ol' : 'ul';
          return (
            <List
              key={key}
              className={`${block.ordered ? 'list-decimal' : 'list-disc'} flex flex-col gap-1.5 pl-6`}
            >
              {block.items.map((item, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a reply's lines never reorder.
                <li key={j} className="pl-1">
                  {runs(item)}
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={key}>
            {block.lines.map((line, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a reply's lines never reorder.
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
