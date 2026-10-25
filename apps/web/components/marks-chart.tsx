import { dashboard, reportKinds } from '@universityflow/content';
import { chartKinds, type MarksPoint, type ReportKind } from '@universityflow/ui';
import { useId } from 'react';
import { Card } from './ui';

/**
 * The learner's marks over time (docs/design/README.md): one series, the average of every subject
 * on each confirmed report, on a fixed 0–100% scale with the school year's four reports along the
 * bottom. No chart library (bundle budgets) and no JavaScript: a server component.
 *
 * Drawn per the data-viz method, in the dashboard reference's style: an area chart, a 2px line in
 * the light pink accent (3:1 on the card, NON_TEXT_PAIRS) over a soft mauve gradient fill, 10px dots
 * with a ring in the card's colour, solid hairline gridlines, labels in text colours, and the
 * newest value in a small card on a dashed marker (the reference's tooltip; a marker, not a grid). One series, so the title names it (no legend). The table under
 * "Show as a table" is the accessible equivalent: every subject, every report. With fewer than two
 * reports there is no line to draw: an honest sentence instead.
 */

const GRID = [0, 25, 50, 75, 100];

/**
 * Where a report sits along the axis. The axis is `chartKinds` (packages/ui), never all eight
 * kinds: eight labels could not fit a 360 px phone and widened the whole home (A2-63).
 */
const xOn = (axis: ReadonlyArray<ReportKind>) => (point: MarksPoint) =>
  ((axis.indexOf(point.kind) + 0.5) / axis.length) * 100;
const y = (percent: number) => 100 - percent;

export function MarksChart({
  points,
  subjectNames,
}: {
  points: ReadonlyArray<MarksPoint>;
  subjectNames: Readonly<Record<string, string>>;
}) {
  const id = useId();
  const t = dashboard.chart;
  const last = points.at(-1);
  const axis = chartKinds(points);
  const x = xOn(axis);
  return (
    // On `Card` with the page's one card-title size and PageHeader's 8px to the lead (A2-23).
    <Card aria-labelledby={`${id}-title`} className="md:col-span-full">
      <div className="flex flex-col gap-2">
        <h2 id={`${id}-title`} className="text-lg">
          {t.title}
        </h2>
        <p className="text-muted">{t.lead}</p>
      </div>

      {points.length === 0 ? <p className="mt-4">{t.none}</p> : null}
      {points.length === 1 && last ? (
        <p className="mt-4">{t.one(reportKinds[last.kind], last.average)}</p>
      ) : null}

      {points.length >= 2 ? (
        <div className="mt-4" aria-hidden="true" data-testid="marks-chart">
          <div className="flex gap-2">
            {/* The y-axis: clean ticks, recessive. */}
            <div className="relative h-48 w-9 shrink-0 text-sm text-muted">
              {GRID.map((g) => (
                <span
                  key={g}
                  className="absolute right-0 -translate-y-1/2 tabular-nums"
                  style={{ top: `${y(g)}%` }}
                >
                  {g}
                </span>
              ))}
            </div>
            <div className="relative h-48 flex-1">
              <svg
                className="absolute inset-0 size-full overflow-visible"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <defs>
                  <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                    <stop
                      offset="0"
                      style={{ stopColor: 'var(--uf-color-brand)', stopOpacity: 0.45 }}
                    />
                    <stop
                      offset="1"
                      style={{ stopColor: 'var(--uf-color-brand)', stopOpacity: 0 }}
                    />
                  </linearGradient>
                </defs>
                {GRID.map((g) => (
                  <line
                    key={g}
                    x1="0"
                    x2="100"
                    y1={y(g)}
                    y2={y(g)}
                    className="stroke-line"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <polygon
                  points={[
                    `${points[0] ? x(points[0]) : 0},100`,
                    ...points.map((p) => `${x(p)},${y(p.average)}`),
                    `${last ? x(last) : 0},100`,
                  ].join(' ')}
                  fill={`url(#${id}-fill)`}
                  stroke="none"
                />
                {last ? (
                  <line
                    x1={x(last)}
                    x2={x(last)}
                    y1={y(last.average)}
                    y2="100"
                    className="stroke-line-strong"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
                <polyline
                  points={points.map((p) => `${x(p)},${y(p.average)}`).join(' ')}
                  fill="none"
                  className="stroke-accent"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {points.map((p) => (
                <span
                  key={p.kind}
                  title={t.point(reportKinds[p.kind], p.average)}
                  className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
                  style={{ left: `${x(p)}%`, top: `${y(p.average)}%` }}
                />
              ))}
              {last ? (
                <span
                  className="absolute -translate-x-1/2 -translate-y-full pb-3"
                  style={{ left: `${x(last)}%`, top: `${y(last.average)}%` }}
                >
                  <span className="block rounded-md border border-line bg-sunk px-2 py-1 text-center text-sm leading-tight">
                    <span className="block text-muted">{t.short[last.kind]}</span>
                    <span className="block font-bold text-ink">{t.percent(last.average)}</span>
                  </span>
                </span>
              ) : null}
            </div>
          </div>
          <div className="ml-11 flex text-center text-sm text-muted" data-testid="marks-axis">
            {axis.map((kind) => (
              <span key={kind} className="min-w-0 flex-1">
                {t.short[kind]}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {points.length >= 1 ? (
        <details className="uf-door mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-medium text-brand underline underline-offset-4">
            {t.showTable}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <caption className="sr-only">{t.title}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 pr-4">
                    {t.subject}
                  </th>
                  {points.map((p) => (
                    <th key={p.kind} scope="col" className="py-2 pr-4">
                      {t.short[p.kind]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(subjectNames)
                  .sort(([, a], [, b]) => a.localeCompare(b))
                  .map(([subjectId, name]) => (
                    <tr key={subjectId} className="border-b border-line">
                      <th scope="row" className="py-2 pr-4 font-normal">
                        {name}
                      </th>
                      {points.map((p) => {
                        const mark = p.marks.find((m) => m.subject === subjectId);
                        return (
                          <td key={p.kind} className="py-2 pr-4 tabular-nums">
                            {mark ? t.percent(mark.percent) : t.noMark}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                <tr>
                  <th scope="row" className="py-2 pr-4">
                    {t.average}
                  </th>
                  {points.map((p) => (
                    <td key={p.kind} className="py-2 pr-4 font-bold tabular-nums">
                      {t.percent(p.average)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
