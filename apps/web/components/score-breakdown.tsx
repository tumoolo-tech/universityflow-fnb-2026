import type { ScoreBreakdown as Breakdown } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import { breakdown as breakdownCopy, confirm } from '@universityflow/content';
import { Card, SourceLink } from '@/components/ui';

const name = (id: SubjectId) => subject(id).name;

/**
 * How a score is worked out, line by line: each subject's mark and points, the bonuses, the total
 * on the university's scale and its method's source. In the chat beside a course card, and on the
 * course's "What I need" page, where a results card's "Why this score?" lands (`#why`, RT-03).
 * No 'use client': it renders on the server there.
 */
export function ScoreBreakdown({
  breakdown,
  anchor = false,
}: {
  breakdown: Breakdown;
  /** The course page's `#why`; never in the chat, which may show the same course twice (A3-05). */
  anchor?: boolean;
}) {
  return (
    <Card
      as="section"
      {...(anchor ? { id: 'why', 'aria-labelledby': 'why-title' } : {})}
      className="scroll-mt-6"
    >
      <h2 id={anchor ? 'why-title' : undefined} className="mb-2 text-lg">
        {breakdownCopy.title}
      </h2>
      <table className="w-full text-left">
        <caption className="sr-only">{breakdownCopy.title}</caption>
        <thead>
          <tr>
            <th scope="col">{confirm.subject}</th>
            <th scope="col">%</th>
            <th scope="col" className="text-right">
              {breakdown.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {breakdown.lines.map((line) => (
            <tr
              key={line.subject}
              className={`border-t border-line ${line.counted ? '' : 'text-muted'}`}
            >
              <td className="py-1">
                {name(line.subject)}
                <span className="block text-sm">{breakdownCopy.reasons[line.reason]}</span>
              </td>
              <td className="py-1">{line.percent}</td>
              <td className="py-1 text-right">{line.counted ? line.points : '–'}</td>
            </tr>
          ))}
          {breakdown.bonuses.map((b) => (
            <tr key={b.rule} className="border-t border-line">
              <td className="py-1">{name(b.subject)}</td>
              <td />
              <td className="py-1 text-right">{breakdownCopy.bonus(b.points)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-thick border-line-strong font-bold">
            <td className="py-1">{breakdownCopy.total}</td>
            <td />
            <td className="py-1 text-right">
              {breakdown.total} / {breakdown.maximum}
            </td>
          </tr>
        </tfoot>
      </table>
      {breakdown.incomplete ? <p className="mt-2 text-sm">{breakdownCopy.incomplete}</p> : null}
      <p className="mt-2">
        <SourceLink href={breakdown.methodSourceUrl}>{breakdownCopy.method}</SourceLink>
      </p>
    </Card>
  );
}
