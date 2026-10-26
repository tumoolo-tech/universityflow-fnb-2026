import { type CvBlock, cvTextBlocks } from './cv-text';

/**
 * An AI reply in the chat as structure (RT-02), for the web and the app: the model writes the
 * small Markdown subset the system prompt allows, and the learner sees real paragraphs, lists and
 * bold words, never the asterisks. The CV's safe subset (cv-text.ts) plus numbered steps. A link
 * stays its words and its address, as text: a model can make up an address, and the official
 * links are in the panels the tools show. Never HTML. Pure TypeScript (hard rule 11).
 */
export function replyTextBlocks(text: string | null | undefined): CvBlock[] {
  return cvTextBlocks(text, { numbered: true, links: false });
}
