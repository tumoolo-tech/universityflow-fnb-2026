import { crisisCard } from '@universityflow/agent';
import { catalogueView } from '@universityflow/catalogue';
import { describe, expect, it } from 'vitest';
import { writtenCare } from '../lib/server/plan-care';

/**
 * What a learner just wrote, read by the same deterministic crisis check as the chat (D3,
 * docs/design/plan-maps-proposal.md §5.2): the words are saved anyway, and the answer carries the
 * crisis card, built by the same code as the chat's from the lines the learner may see.
 */

const view = catalogueView(new Date('2026-10-14T08:00:00Z'), { includeDrafts: true });

describe('writtenCare', () => {
  it('a crisis reflection gets the crisis card, from the view’s lines only', () => {
    const care = writtenCare(
      { heading: 'Grade 11', texts: ['I failed because I wanted to die that year'] },
      view.helplines,
    );
    expect(care?.level).toBe('crisis');
    if (care?.level !== 'crisis') throw new Error('expected a crisis');
    expect(care.card).toEqual(crisisCard(view.helplines, ['suicide']));
    for (const line of care.card.helplines) {
      expect(view.helplines.map((h) => h.id)).toContain(line.id);
    }
  });

  it('a concern gets the card too; with no lines, a card that says so', () => {
    const care = writtenCare({ texts: ['I felt so hopeless I stopped trying'] }, view.helplines);
    expect(care?.level).toBe('concern');
    const none = writtenCare({ texts: ['I wanted to die'] }, []);
    expect(none).toMatchObject({ level: 'crisis', card: { helplines: [] } });
  });

  it('reads the words after their heading, as a split message is read', () => {
    expect(writtenCare({ texts: ['die'] }, view.helplines)).toBeNull();
    expect(writtenCare({ heading: 'I just want to', texts: ['die'] }, view.helplines)?.level).toBe(
      'crisis',
    );
    // Every field the learner wrote counts, whichever it is in.
    expect(
      writtenCare(
        { heading: 'Matric', texts: [null, 'Ran out of time', 'I want to die'] },
        view.helplines,
      )?.level,
    ).toBe('crisis');
  });

  it('a false alarm gets nothing; a setback gets the one kind line, no card', () => {
    expect(
      writtenCare({ heading: 'Grade 10', texts: ['I killed it in maths'] }, view.helplines),
    ).toBeNull();
    expect(
      writtenCare(
        { heading: 'Matric', texts: ['I died laughing at the trial results'] },
        view.helplines,
      ),
    ).toBeNull();
    expect(writtenCare({ heading: 'Grade 11', texts: [] }, view.helplines)).toBeNull();
    expect(
      writtenCare({ heading: 'Grade 11', texts: ['I failed my trial exams'] }, view.helplines),
    ).toEqual({ level: 'setback' });
  });

  it('adds the campus lines it is given, after the helplines', () => {
    const campus = {
      universityId: 'wits',
      universityName: 'Synthetic University',
      lines: [
        {
          id: 'synthetic-line',
          name: 'Campus line',
          kind: 'security',
          campusName: 'Main',
          phone: '0800000000',
          where: null,
          hours: null,
          walkUrl: null,
        },
      ],
    } as unknown as Parameters<typeof writtenCare>[2];
    const care = writtenCare({ texts: ['I want to die'] }, view.helplines, campus);
    expect(care?.level === 'crisis' && care.card.campus?.lines[0]?.id).toBe('synthetic-line');
  });
});
