import type { FieldSource, Resolved, ResolvedScheme } from '@universityflow/admissions/client';
import type { ModuleTerm, Weighting } from '@universityflow/catalogue';
import { moduleCard, modules } from '@universityflow/content/app';
import { asTemplates, type CalculatorWords, type SavedMark } from './mark-calculator';

/**
 * The module card (Phase 6c; docs/plans/phase-6-proposal.md, "What a learner gets", D2, D3, D6,
 * D7): one confirmed module's How marks work, Dates, Books and Who teaches it, as words, for the
 * web page (on the server) and the app's screen alike. Built from `ModuleCardData`, which the
 * server assembles (apps/web/lib/server/module-card.ts) from the scheme `admissions.resolveScheme`
 * resolved (hard rule 2: code decides), the academic calendar, the learner's confirmed outline (hard
 * rule 6), the free books already in words (the book rules and their words stay on the server, so
 * the app's bundles and the browser carry neither, A4-13) and the faculty
 * office record. `GET /api/modules/:registrationId/:code` returns it for the app.
 *
 * Every value says where it came from, with its date. A draft is labelled a preview. A field nobody
 * publishes says "not published" and who to ask: never a usual number (gotcha 40). When the
 * learner's outline and a published record disagree, both are shown: "these disagree: ask your
 * lecturer" (D2).
 *
 * Plain TypeScript, no DOM or Node (hard rule 11); the copy from `@universityflow/content/app`.
 */

// ── What the server sends ────────────────────────────────────────────────────────────────────

/** The title and verification date of a catalogue record the scheme used, by record id. */
export interface CardRecordInfo {
  readonly title?: string;
  /** Only once a person verified it (hard rule 3). */
  readonly verifiedOn?: string;
}

export type CardSection<T> =
  | { readonly status: 'not-in-outline' }
  | { readonly status: 'confirmed'; readonly items: ReadonlyArray<T> };

export interface CardOutlineBook {
  readonly role: 'prescribed' | 'recommended';
  readonly title: string;
  readonly authors: string | null;
  readonly edition: string | null;
  readonly isbn: string | null;
}

/** A lecturer's work details only, as the learner confirmed them (D3). */
export interface CardOutlinePerson {
  readonly name: string;
  readonly role: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly office: string | null;
  readonly consultationTimes: string | null;
}

export interface CardOutline {
  /** YYYY-MM-DD the learner confirmed it. */
  readonly confirmedOn: string;
  readonly dates: CardSection<{ readonly label: string; readonly date: string }>;
  readonly books: CardSection<CardOutlineBook>;
  readonly people: CardSection<CardOutlinePerson>;
}

interface Dated {
  readonly label: string;
  readonly date: string;
}
interface Ranged {
  readonly label: string;
  readonly from: string;
  readonly to: string;
}

export interface CardCalendar {
  readonly academicYear: number;
  readonly sourceUrl: string;
  readonly draft: boolean;
  readonly verifiedOn?: string;
  readonly examPeriods: ReadonlyArray<Ranged>;
  readonly supplementaryExams: ReadonlyArray<Ranged>;
  readonly supplementaryRegistration: ReadonlyArray<Dated>;
  readonly dpLists: ReadonlyArray<Dated>;
}

/**
 * The free books and the library's own search, already in words: the server works them out with
 * the catalogue's `freeBooksFor` and the free-book words (apps/web/lib/server/module-card-books.ts),
 * so neither the book rules nor those words reach the browser or the app's bundles (A4-13).
 */
export interface CardBooks {
  readonly free: {
    readonly title: string;
    readonly lead: string;
    readonly books: ReadonlyArray<{
      /** "Your prescribed book is free" or "Not your prescribed book: check with your lecturer". */
      readonly label: string;
      readonly title: string;
      readonly link: string;
      readonly url: string;
      readonly details: ReadonlyArray<string>;
      readonly draft: boolean;
    }>;
    readonly none: string | null;
    readonly onlyLegal: string;
  };
  readonly library: {
    readonly links: ReadonlyArray<{ readonly label: string; readonly url: string }>;
    readonly note: string;
    readonly draft: boolean;
  } | null;
  readonly noLibrary: string | null;
}

export interface CardOffice {
  readonly faculty: string;
  readonly where: string;
  readonly hours: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly contactUrl: string;
  readonly draft: boolean;
}

export interface ModuleCardData {
  readonly registrationId: string;
  readonly module: {
    readonly code: string;
    readonly name: string | null;
    readonly term: ModuleTerm | null;
    readonly academicYear: number;
    readonly universityName: string;
  };
  /** The judge demo's SAMPLE outline and made-up marks: the card says so. */
  readonly sample: boolean;
  readonly scheme: ResolvedScheme;
  readonly records: Readonly<Record<string, CardRecordInfo>>;
  readonly outline: CardOutline | null;
  readonly calendar: CardCalendar | null;
  readonly books: CardBooks;
  readonly office: CardOffice | null;
  readonly marks: ReadonlyArray<SavedMark>;
  readonly target: number | null;
  /** Today in South Africa (YYYY-MM-DD): dates before it are marked past. */
  readonly today: string;
}

// ── What the card shows ──────────────────────────────────────────────────────────────────────

export interface SourceView {
  readonly text: string;
  readonly url: string | null;
  /** "Checked by a person on …", once a person verified the record. */
  readonly checked: string | null;
  /** Not yet verified: shown only in preview, always labelled (A10-13). */
  readonly draft: boolean;
}

export type HowRowId = keyof typeof moduleCard.how.labels;

export interface HowRow {
  readonly id: HowRowId;
  readonly label: string;
  readonly lines: ReadonlyArray<string>;
  /** Null when nothing is published: `lines` then says so, and who to ask. */
  readonly source: SourceView | null;
  /** D2: a published record says something else. */
  readonly conflict: {
    readonly text: string;
    readonly other: string;
    readonly source: SourceView;
  } | null;
}

export interface ModuleCardView {
  readonly code: string;
  readonly name: string | null;
  readonly subtitle: string;
  readonly universityName: string;
  readonly sampleNotice: string | null;
  /** Set when anything on the card is a draft. */
  readonly previewNotice: string | null;
  readonly how: {
    readonly title: string;
    readonly lead: string;
    readonly rows: ReadonlyArray<HowRow>;
    readonly otherRules: ReadonlyArray<{ readonly quote: string; readonly source: SourceView }>;
  };
  readonly dates: {
    readonly title: string;
    readonly outline: {
      readonly source: string;
      readonly items: ReadonlyArray<{ label: string; date: string; past: boolean }>;
    } | null;
    readonly calendar: {
      readonly source: SourceView;
      readonly groups: ReadonlyArray<{ label: string; items: ReadonlyArray<string> }>;
    } | null;
    readonly none: string | null;
  };
  readonly books: {
    readonly title: string;
    readonly outline: ReadonlyArray<{
      readonly role: string;
      readonly title: string;
      readonly details: ReadonlyArray<string>;
    }>;
    /** "Add your outline" (with `addOutline` as the link), or "lists no books". */
    readonly outlineNote: string | null;
    readonly addOutline: string | null;
  } & CardBooks;
  readonly people: {
    readonly title: string;
    readonly source: string | null;
    readonly people: ReadonlyArray<{
      readonly name: string;
      readonly role: string | null;
      readonly details: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
        readonly href: string | null;
      }>;
    }>;
    readonly notPublished: string | null;
    readonly askOffice: string | null;
    readonly office: CardOffice | null;
    readonly noOffice: string | null;
  };
  readonly calculator: { readonly title: string; readonly lead: string };
}

const t = moduleCard;
const how = t.how;

/** The calculator's words as the browser and the app receive them (`{0}`-templates). */
export function calculatorWords(): CalculatorWords {
  return asTemplates(t.calculator);
}

type FormatDate = (iso: string) => string;

function sourceView(source: FieldSource, data: ModuleCardData, formatDate: FormatDate): SourceView {
  const info = source.recordId ? data.records[source.recordId] : undefined;
  let text: string;
  if (source.level === 'outline') {
    const on = formatDate(source.confirmedOn ?? data.outline?.confirmedOn ?? data.today);
    text = data.sample ? t.sources.sampleOutline(on) : t.sources.outline(on);
  } else if (source.level === 'module') {
    text = t.sources.module(source.recordId ?? data.module.code, source.academicYear);
  } else {
    text = t.sources.rules(info?.title ?? data.module.universityName, source.academicYear);
  }
  return {
    text,
    url: source.sourceUrl ?? null,
    checked: info?.verifiedOn ? t.sources.checkedOn(formatDate(info.verifiedOn)) : null,
    draft: source.draft,
  };
}

function weightingLines(w: Weighting): string[] {
  if (w.components) {
    return w.components.map((c) => {
      const extra = [
        c.bestOf ? how.bestOf(c.bestOf.count, c.bestOf.of) : null,
        c.subminimum !== undefined ? how.componentOwnSubminimum(c.subminimum) : null,
      ].filter((x): x is string => x !== null);
      const line = how.component(c.name, c.weight);
      return extra.length > 0 ? `${line} (${extra.join(', ')})` : line;
    });
  }
  if (w.yearMarkWeight !== undefined && w.examWeight !== undefined) {
    return [how.yearAndExam(w.yearMarkWeight, w.examWeight)];
  }
  return [];
}

/** Each field's value in words; the same words for a conflicting published value. */
const FORMAT: {
  readonly [K in HowRowId]: (value: never) => string[];
} = {
  weighting: (w: Weighting) => weightingLines(w),
  passMark: (n: number) => [how.percent(n)],
  examAdmission: (a: NonNullable<ResolvedScheme['examAdmission']>['value']) => {
    const term = a.term ?? how.admissionTerm;
    return [
      a.minimumYearMark !== undefined
        ? how.admissionNumber(term, a.minimumYearMark)
        : how.admissionNoNumber(term),
      ...(a.conditions.length > 0 ? [`${how.conditionsTitle}: ${a.conditions.join('; ')}`] : []),
    ];
  },
  examSubminimum: (n: number) => [how.percent(n)],
  componentSubminimum: (c: NonNullable<ResolvedScheme['componentSubminimum']>['value']) => [
    c.fromWeight !== undefined
      ? how.componentSubminimumFrom(c.value, c.fromWeight)
      : how.componentSubminimumAll(c.value),
  ],
  supplementary: (s: NonNullable<ResolvedScheme['supplementary']>['value']) => {
    if (s.offered === false) return [how.supplementaryNotOffered];
    const range = s.eligibleFinalMark;
    const lines = [
      !range
        ? how.supplementaryNoRange
        : range.to === undefined
          ? how.supplementaryFrom(range.from)
          : how.supplementaryRange(range.from, range.to),
    ];
    const r = s.result;
    if (!r) lines.push(how.supplementaryResultNotPublished);
    else if (r.kind === 'capped-at') lines.push(how.supplementaryCapped(r.cap));
    else lines.push(how.supplementaryResults[r.kind]);
    for (const words of s.alsoWhen ?? []) lines.push(how.alsoWhen(words));
    for (const words of s.notWhen ?? []) lines.push(how.notWhen(words));
    return lines;
  },
  deferredExam: (quote: string) => [quote],
  rounding: (m: NonNullable<ResolvedScheme['rounding']>['value']) => [how.roundings[m]],
  distinction: (n: number) => [how.percent(n)],
};

/** Who to ask when a field isn't published: the lecturer for the module's own, else the office. */
const ASK: Readonly<Record<HowRowId, string | null>> = {
  weighting: how.notPublishedLecturer,
  passMark: how.notPublishedOffice,
  examAdmission: how.notPublishedLecturer,
  examSubminimum: how.notPublishedLecturer,
  supplementary: how.notPublishedOffice,
  // Rules many modules simply don't have: left off the card when nothing prints them.
  componentSubminimum: null,
  deferredExam: null,
  rounding: null,
  distinction: null,
};

const ROWS: ReadonlyArray<HowRowId> = [
  'weighting',
  'passMark',
  'examAdmission',
  'examSubminimum',
  'componentSubminimum',
  'supplementary',
  'deferredExam',
  'rounding',
  'distinction',
];

function howRows(data: ModuleCardData, formatDate: FormatDate): HowRow[] {
  const rows: HowRow[] = [];
  for (const id of ROWS) {
    const resolved = data.scheme[id] as Resolved<unknown> | undefined;
    const format = FORMAT[id] as (value: unknown) => string[];
    if (!resolved) {
      const ask = ASK[id];
      if (ask) rows.push({ id, label: how.labels[id], lines: [ask], source: null, conflict: null });
      continue;
    }
    const conflict = resolved.conflict;
    rows.push({
      id,
      label: how.labels[id],
      lines: format(resolved.value),
      source: sourceView(resolved.source, data, formatDate),
      conflict: conflict
        ? {
            text: how.conflict,
            other: how.conflictOther(
              sourceView(conflict.source, data, formatDate).text,
              format(conflict.value).join('; '),
            ),
            source: sourceView(conflict.source, data, formatDate),
          }
        : null,
    });
  }
  return rows;
}

function datesPart(data: ModuleCardData, formatDate: FormatDate): ModuleCardView['dates'] {
  const outlineDates =
    data.outline?.dates.status === 'confirmed'
      ? [...data.outline.dates.items]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => ({ label: d.label, date: formatDate(d.date), past: d.date < data.today }))
      : null;
  const cal = data.calendar;
  const range = (r: Ranged) => `${r.label}: ${t.dates.range(formatDate(r.from), formatDate(r.to))}`;
  const dated = (d: Dated) => `${d.label}: ${formatDate(d.date)}`;
  const groups = cal
    ? [
        { label: t.dates.examPeriods, items: cal.examPeriods.map(range) },
        { label: t.dates.supplementaryExams, items: cal.supplementaryExams.map(range) },
        {
          label: t.dates.supplementaryRegistration,
          items: cal.supplementaryRegistration.map(dated),
        },
        { label: t.dates.dpLists, items: cal.dpLists.map(dated) },
      ].filter((g) => g.items.length > 0)
    : [];
  const calendar =
    cal && groups.length > 0
      ? {
          source: {
            text: t.dates.fromCalendar(data.module.universityName, cal.academicYear),
            url: cal.sourceUrl,
            checked: cal.verifiedOn ? t.sources.checkedOn(formatDate(cal.verifiedOn)) : null,
            draft: cal.draft,
          },
          groups,
        }
      : null;
  const outline =
    outlineDates && outlineDates.length > 0
      ? { source: t.dates.fromOutline, items: outlineDates }
      : null;
  return {
    title: t.dates.title,
    outline,
    calendar,
    none: outline || calendar ? null : t.dates.none,
  };
}

function booksPart(data: ModuleCardData): ModuleCardView['books'] {
  const books = data.outline?.books;
  const outline =
    books?.status === 'confirmed'
      ? books.items.map((b) => ({
          role: b.role === 'prescribed' ? t.books.prescribed : t.books.recommended,
          title: b.title,
          details: [
            b.authors ? t.books.by(b.authors) : null,
            b.edition ? t.books.edition(b.edition) : null,
            b.isbn ? t.books.isbn(b.isbn) : null,
          ].filter((x): x is string => x !== null),
        }))
      : [];
  return {
    title: t.books.title,
    outline,
    outlineNote: !books
      ? t.books.noOutline
      : books.status === 'not-in-outline'
        ? t.books.notInOutline
        : null,
    addOutline: books ? null : t.books.addOutline,
    // Worded on the server (A4-13): passed through as it came.
    ...data.books,
  };
}

function peoplePart(data: ModuleCardData): ModuleCardView['people'] {
  const people = data.outline?.people;
  type Detail = { label: string; value: string; href: string | null };
  const detailsOf = (p: CardOutlinePerson): Detail[] => {
    const details: Detail[] = [];
    if (p.email) details.push({ label: t.people.email, value: p.email, href: `mailto:${p.email}` });
    if (p.phone) {
      details.push({
        label: t.people.phone,
        value: p.phone,
        href: `tel:${p.phone.replace(/[^\d+]/g, '')}`,
      });
    }
    if (p.office) details.push({ label: t.people.office, value: p.office, href: null });
    if (p.consultationTimes) {
      details.push({ label: t.people.consultation, value: p.consultationTimes, href: null });
    }
    return details;
  };
  const listed =
    people?.status === 'confirmed'
      ? people.items.map((p) => ({ name: p.name, role: p.role, details: detailsOf(p) }))
      : [];
  return {
    title: t.people.title,
    source: listed.length > 0 ? t.people.fromOutline : null,
    people: listed,
    notPublished: listed.length > 0 ? null : t.people.notPublished,
    askOffice: data.office ? t.people.askOffice(data.office.faculty) : null,
    office: data.office,
    noOffice: data.office ? null : modules.noOffice,
  };
}

/** The card, in words, from what the server sent. `formatDate` is the app's or the web's own. */
export function moduleCardView(data: ModuleCardData, formatDate: FormatDate): ModuleCardView {
  const term = data.module.term ? modules.terms[data.module.term] : null;
  const anyDraft =
    data.scheme.includesDrafts ||
    (data.calendar?.draft ?? false) ||
    data.books.free.books.some((b) => b.draft) ||
    (data.books.library?.draft ?? false) ||
    (data.office?.draft ?? false);
  return {
    code: data.module.code,
    name: data.module.name,
    subtitle: term
      ? t.termAndYear(term, data.module.academicYear)
      : String(data.module.academicYear),
    universityName: data.module.universityName,
    sampleNotice: data.sample ? t.demoSample : null,
    previewNotice: anyDraft ? t.previewNote : null,
    how: {
      title: how.title,
      lead: how.lead,
      rows: howRows(data, formatDate),
      otherRules: data.scheme.otherRules.map((r) => ({
        quote: r.quote,
        source: sourceView(r.source, data, formatDate),
      })),
    },
    dates: datesPart(data, formatDate),
    books: booksPart(data),
    people: peoplePart(data),
    calculator: { title: t.calculator.title, lead: t.calculator.lead },
  };
}
