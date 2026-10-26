import { type CvBlock, type CvInline, cvInlineText } from '@universityflow/ui';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

/**
 * An AI reply as real structure (RT-02), as the web's chat shows it: paragraphs, bullet and
 * numbered lists, bold and italic words and headings, read from the small Markdown subset the
 * system prompt allows (`replyTextBlocks`, packages/ui), so the learner never sees
 * "* **Howard College**". Nothing but Text: a reply is never HTML, and a link stays its words and
 * its address. The bullet and number marks are drawn, hidden from screen readers; the message's
 * own label (`replyLabel`) reads the words once, without the marks.
 */

const ink = { color: theme.color.ink };

function Runs({ runs }: { runs: ReadonlyArray<CvInline> }) {
  return (
    <>
      {runs.map((run, i) => {
        // The runs never reorder: their place is their key.
        const key = `${run.kind}-${i}`;
        if (run.kind === 'text') return run.text;
        if (run.kind === 'strong') {
          return (
            <Text key={key} style={theme.text.bodyStrong}>
              <Runs runs={run.children} />
            </Text>
          );
        }
        if (run.kind === 'em') {
          return (
            <Text key={key} style={styles.em}>
              <Runs runs={run.children} />
            </Text>
          );
        }
        // A reply has no links (`replyTextBlocks`): anything else is its words.
        return (
          <Fragment key={key}>
            <Runs runs={run.children} />
          </Fragment>
        );
      })}
    </>
  );
}

/** A reply's words for a screen reader: one line per paragraph line, item and heading. */
export function replyLabel(blocks: ReadonlyArray<CvBlock>): string {
  return blocks
    .flatMap((block) => {
      if (block.kind === 'heading') return [cvInlineText(block.content)];
      if (block.kind === 'list') {
        return block.items.map((item, j) =>
          block.ordered ? `${j + 1}. ${cvInlineText(item)}` : cvInlineText(item),
        );
      }
      return block.lines.map(cvInlineText);
    })
    .join('\n');
}

export function ReplyText({ blocks }: { blocks: ReadonlyArray<CvBlock> }) {
  return (
    <View style={styles.reply}>
      {blocks.map((block, i) => {
        const key = `${block.kind}-${i}`;
        if (block.kind === 'heading') {
          return (
            <Text key={key} style={[theme.text.bodyStrong, ink]}>
              <Runs runs={block.content} />
            </Text>
          );
        }
        if (block.kind === 'list') {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a reply's lines never reorder.
                <View key={j} style={styles.item}>
                  <Text
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                    style={[theme.text.body, ink, styles.mark]}
                  >
                    {block.ordered ? `${j + 1}.` : '•'}
                  </Text>
                  <Text selectable style={[theme.text.body, ink, styles.itemText]}>
                    <Runs runs={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={key} selectable style={[theme.text.body, ink]}>
            {block.lines.map((line, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a reply's lines never reorder.
              <Fragment key={j}>
                {j > 0 ? '\n' : null}
                <Runs runs={line} />
              </Fragment>
            ))}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  reply: { flex: 1, gap: theme.space['2'] },
  list: { gap: theme.space['1'] },
  item: { flexDirection: 'row', gap: theme.space['2'] },
  mark: { minWidth: theme.space['4'] },
  itemText: { flex: 1 },
  em: { fontStyle: 'italic' },
});
