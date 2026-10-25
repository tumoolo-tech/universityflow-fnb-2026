import type { AtsResult, JobAdvert } from './engine';
import type { CvProfile } from './profile';

/**
 * The fake engine's renderer and scorer (§6.2): deterministic, no model, no network. Not Mmereko's
 * template: just enough that local development, tests and E2E see a real CV text, a real (tiny)
 * PDF and an ATS score that moves with the words.
 */

const line = (...parts: Array<string | null | undefined>) =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(', ');

const when = (start?: string | null, end?: string | null) =>
  start || end ? ` (${start ?? ''} to ${end ?? 'now'})` : '';

/** The profile as plain markdown text, every section that is present, in a fixed order. */
export function renderCvMarkdown(profile: CvProfile): string {
  const out: string[] = [`# ${profile.basics.name}`];
  const contact = line(
    profile.basics.label,
    profile.basics.email,
    profile.basics.phone,
    profile.basics.location?.city,
  );
  if (contact) out.push('', contact);
  if (profile.basics.summary) out.push('', profile.basics.summary);
  if ((profile.education ?? []).length > 0) {
    out.push('', '## Education');
    for (const e of profile.education ?? []) {
      out.push(`- ${line(e.studyType, e.area, e.institution)}${when(e.startDate, e.endDate)}`);
      for (const s of e.xSubjects ?? []) out.push(`  - ${line(s.name, s.result)}`);
      for (const c of e.courses ?? []) out.push(`  - ${c}`);
    }
  }
  const section = (title: string, items: string[]) => {
    if (items.length > 0) out.push('', `## ${title}`, ...items.map((i) => `- ${i}`));
  };
  section(
    'Projects',
    (profile.projects ?? []).map(
      (p) => `${line(p.name, p.description, ...(p.xEvidence ?? []).map((x) => x.url))}`,
    ),
  );
  section(
    'Skills',
    (profile.skills ?? []).map((s) => line(s.name, ...(s.keywords ?? []))),
  );
  section(
    'Work',
    (profile.work ?? []).map((w) => `${line(w.position, w.name)}${when(w.startDate, w.endDate)}`),
  );
  section(
    'Volunteering',
    (profile.volunteer ?? []).map(
      (v) => `${line(v.position, v.organization)}${when(v.startDate, v.endDate)}`,
    ),
  );
  section(
    'Awards',
    (profile.awards ?? []).map((a) => line(a.title, a.awarder, a.date)),
  );
  section(
    'Certificates',
    (profile.certificates ?? []).map((c) => line(c.name, c.issuer, c.date)),
  );
  section(
    'Languages',
    (profile.languages ?? []).map((l) => line(l.language, l.fluency)),
  );
  return `${out.join('\n')}\n`;
}

/** Text a PDF string can hold: printable ASCII, with ( ) \ escaped. */
function pdfText(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/[\\()]/g, (c) => `\\${c}`);
}

/**
 * A one-page A4 PDF of the text, Helvetica, one line per line (cut at 90 characters, at most 60
 * lines). Valid PDF 1.4: the cross-reference offsets are counted, not guessed.
 */
export function renderTinyPdf(text: string): Uint8Array {
  const lines = text
    .split('\n')
    .slice(0, 60)
    .map((l) => pdfText(l.slice(0, 90)));
  const stream = [
    'BT',
    '/F1 10 Tf',
    '14 TL',
    '50 800 Td',
    ...lines.map((l) => `(${l}) '`),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

const STOP_WORDS = new Set(
  'a an and are as at be by for from has have in is it of on or our the to we who with you your will can must able plus use used work works well team'.split(
    ' ',
  ),
);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9+#.-]*[a-z0-9+#]|[a-z]/g) ?? []).filter(
    (w) => w.length > 1 && !STOP_WORDS.has(w),
  );
}

/**
 * A simple keyword overlap (§6.2): the advert's distinct words, which of them the CV has, and the
 * share it covers. Words after "must" in the same sentence are must-haves.
 */
export function scoreAts(cvText: string, job: JobAdvert): AtsResult {
  const advert = [...new Set(words(`${job.title} ${job.description}`))];
  const have = new Set(words(cvText));
  const matched = advert.filter((w) => have.has(w));
  const missing = advert.filter((w) => !have.has(w));
  const must = new Set(
    (job.description.toLowerCase().match(/must[^.]*/g) ?? []).flatMap((s) => words(s)),
  );
  return {
    coveragePct: advert.length === 0 ? 0 : Math.round((matched.length / advert.length) * 100),
    matched,
    missing,
    missingMustHaves: missing.filter((w) => must.has(w)),
    flags: [],
  };
}
