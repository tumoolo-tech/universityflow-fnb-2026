import type { SchoolRecord } from '@universityflow/admissions';
import { type SubjectId, subject } from '@universityflow/catalogue/client';
import { passTypes, reportKinds, schoolRecord as t } from '@universityflow/content';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { formatDate } from '@/lib/client/api';

/**
 * The school record on *My results* (planning.md §18.7 C2): every report the learner confirmed,
 * side by side, exactly as packages/admissions laid it out (levels, changes and passes are worked
 * out there, hard rule 2). Rendered on the server: no browser code. Every mark sits under its
 * report's column, which says who entered it. Nothing before a report is confirmed (hard rule 6).
 */

const subjectName = (id: SubjectId) => {
  try {
    return subject(id).name;
  } catch {
    return id;
  }
};

export function SchoolRecordSection({ record }: { record: SchoolRecord }) {
  if (record.reports.length === 0) return null;
  const headingId = 'school-record';
  return (
    <Card aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-lg">
          {t.title}
        </h2>
        <p className="text-muted">{t.lead}</p>
      </div>
      {/* On a phone the table scrolls sideways: the box is named and takes focus, so a keyboard
          can scroll it too (WCAG 2.1.1; axe scrollable-region-focusable). */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region must be focusable */}
      <section className="overflow-x-auto" aria-label={t.caption} tabIndex={0}>
        <table className="w-full text-left">
          <caption className="sr-only">{t.caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-2 align-bottom">
                {t.subject}
              </th>
              {record.reports.map((r) => (
                <th key={r.kind} scope="col" className="px-2 py-2 text-right align-bottom">
                  <span className="block">{reportKinds[r.kind]}</span>
                  <span className="block text-sm font-normal text-muted">
                    {formatDate(r.confirmedAt)}
                  </span>
                  <Badge>{t.source[r.source]}</Badge>
                </th>
              ))}
              <th scope="col" className="py-2 pl-2 text-right align-bottom">
                {t.changeHeading}
              </th>
            </tr>
          </thead>
          <tbody>
            {record.rows.map((row) => (
              <tr key={row.subject} className="border-t border-line">
                <th scope="row" className="py-2 font-normal">
                  {subjectName(row.subject)}
                </th>
                {row.marks.map((m, i) => (
                  <td key={record.reports[i]?.kind ?? i} className="px-2 py-2 text-right">
                    {m ? (
                      <>
                        <span className="block">{t.percent(m.percent)}</span>
                        <span className="block text-sm text-muted">{t.level(m.level)}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted">{t.noMark}</span>
                    )}
                  </td>
                ))}
                <td className="py-2 pl-2 text-right">
                  {row.change === null ? (
                    <span className="text-sm text-muted">{t.noChange}</span>
                  ) : (
                    t.change(row.change)
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t border-line font-medium">
              <th scope="row" className="py-2">
                {t.pass}
              </th>
              {record.reports.map((r) => (
                <td key={r.kind} className="px-2 py-2 text-right">
                  {passTypes[r.pass]}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </section>
      <p className="text-sm text-muted">{t.passNote}</p>
      <div className="flex flex-col gap-1">
        <h3 className="font-medium">{t.levelsTitle}</h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {record.levels.map((l) => (
            <li key={l.level}>{t.levelRange(l.level, l.from, l.to)}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm">
        {t.correct} <Link href="/documents">{t.correctLink}</Link>
      </p>
    </Card>
  );
}
