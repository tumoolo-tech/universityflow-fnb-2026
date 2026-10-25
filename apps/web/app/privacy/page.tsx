import { en } from '@universityflow/content';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Fill, SiteFooter } from '@/components/site-footer';
import { Page, PublicPage } from '@/components/ui';

export const metadata: Metadata = {
  title: en.privacyPage.title,
  description: en.privacyPage.description,
};

/**
 * The privacy policy (the owner's launch standard; POPIA s18, ECTA s43; audit A11-20). **A
 * template for the legal adviser**, and it says so first. Built from
 * docs/store/privacy-and-data-safety.md, every word from packages/content (`en.privacyPage`);
 * every value only the owner can give shows as "Owner to fill". Open to anyone, it reads nothing
 * about the visitor. A server component with no JavaScript of its own.
 * Held by test/privacy-page.test.tsx.
 */
export default async function PrivacyPage() {
  const p = en.privacyPage;
  const s = p.sections;
  const contents: Array<[string, string]> = [
    ['who-we-are', s.whoWeAre.title],
    ['information-officer', s.officer.title],
    ['what-we-collect', s.collect.title],
    ['why-we-use-it', s.why.title],
    ['under-18', s.children.title],
    ['sensitive', s.sensitive.title],
    ['coming-later', s.later.title],
    ['who-helps-us', s.operators.title],
    ['how-long', s.keep.title],
    ['cookies', s.cookies.title],
    ['security', s.security.title],
    ['your-rights', s.rights.title],
    ['information-regulator', s.regulator.title],
    ['changes', s.changes.title],
  ];
  const fields = Object.keys(p.businessLabels) as Array<keyof typeof p.businessLabels>;
  const r = s.regulator;

  return (
    <>
      <PublicPage brand={{ name: en.app.name, href: '/' }}>
        <div className="uf-privacy flex flex-col gap-8">
          <Page title={p.title}>
            <div role="note" aria-labelledby="privacy-template" className="uf-privacy-template">
              <p id="privacy-template" className="font-bold">
                {p.templateTitle}
              </p>
              <p>{p.templateNotice}</p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-muted">
                {p.updatedLabel}: <Fill value={p.updated} />
              </p>
              <p>{p.intro}</p>
            </div>
          </Page>

          <nav aria-label={p.contentsLabel}>
            <p className="mb-2 font-bold">{p.contentsLabel}</p>
            <ul className="flex flex-col">
              {contents.map(([id, title]) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-11 items-center">
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <Part id="who-we-are" title={s.whoWeAre.title}>
            <p>{s.whoWeAre.lead}</p>
            <Details rows={fields.map((field) => [p.businessLabels[field], p.business[field]])} />
          </Part>

          <Part id="information-officer" title={s.officer.title}>
            <p>{s.officer.lead}</p>
            <Details
              rows={(['name', 'email', 'phone'] as const).map((key) => [
                s.officer.labels[key],
                s.officer.values[key],
              ])}
            />
          </Part>

          <Part id="what-we-collect" title={s.collect.title}>
            <p>{s.collect.lead}</p>
            <Points items={s.collect.items} />
            <h3 className="text-lg">{s.collect.printedTitle}</h3>
            <p>{s.collect.printed}</p>
            <p>{s.collect.notCollected}</p>
          </Part>

          <Part id="why-we-use-it" title={s.why.title}>
            <Points items={s.why.items} />
            <p className="font-medium">{s.why.never}</p>
          </Part>

          <Part id="under-18" title={s.children.title}>
            <Points items={s.children.items} />
          </Part>

          <Part id="sensitive" title={s.sensitive.title}>
            <Points items={s.sensitive.items} />
            <p>
              <Fill value={s.sensitive.legalNote} />
            </p>
          </Part>

          <Part id="coming-later" title={s.later.title}>
            <p>{s.later.lead}</p>
            <Points items={s.later.items} />
          </Part>

          <Part id="who-helps-us" title={s.operators.title}>
            <p>{s.operators.lead}</p>
            <ul className="flex flex-col gap-4">
              {s.operators.items.map((o) => (
                <li key={o.id} className="uf-privacy-operator">
                  <h3 className="text-lg">
                    <Fill value={o.name} />
                  </h3>
                  {'partner' in o ? (
                    <p>
                      <Fill value={o.partner} />
                    </p>
                  ) : null}
                  <Details
                    rows={[
                      [s.operators.labels.does, o.does],
                      [s.operators.labels.gets, o.gets],
                      [s.operators.labels.where, o.where],
                    ]}
                  />
                  {'note' in o ? <p className="font-medium">{o.note}</p> : null}
                </li>
              ))}
            </ul>
            <h3 className="text-lg">{s.operators.crossBorderTitle}</h3>
            <Points items={s.operators.crossBorder} />
            <h3 className="text-lg">{s.operators.separateTitle}</h3>
            <Points items={s.operators.separate} />
          </Part>

          <Part id="how-long" title={s.keep.title}>
            <Points items={s.keep.items} />
            <p>
              <Fill value={s.keep.schedule} />
            </p>
          </Part>

          <Part id="cookies" title={s.cookies.title}>
            <Points items={s.cookies.items} />
          </Part>

          <Part id="security" title={s.security.title}>
            <Points items={s.security.items} />
          </Part>

          <Part id="your-rights" title={s.rights.title}>
            <Points items={s.rights.items} />
            <p>
              <Fill value={s.rights.paiaManual} />
            </p>
          </Part>

          <Part id="information-regulator" title={r.title}>
            <p>{r.lead}</p>
            <Details
              rows={[
                [r.labels.address, r.values.address],
                [r.labels.phone, r.values.phone, `tel:${digits(r.values.phone)}`],
                [r.labels.tollFree, r.values.tollFree, `tel:${digits(r.values.tollFree)}`],
                [r.labels.enquiries, r.values.enquiries, `mailto:${r.values.enquiries}`],
                [r.labels.complaints, r.values.complaints, `mailto:${r.values.complaints}`],
                [r.labels.portal, r.values.portal, r.values.portal],
                [r.labels.website, r.values.website, r.values.website],
              ]}
            />
            <p className="text-sm text-muted">{r.checked}</p>
          </Part>

          <Part id="changes" title={s.changes.title}>
            <p>{s.changes.lead}</p>
          </Part>

          <Link href="/" className="inline-flex min-h-11 items-center self-start">
            {p.backHome}
          </Link>
        </div>
      </PublicPage>
      <SiteFooter width="prose" />
    </>
  );
}

const digits = (phone: string) => phone.replace(/\D/g, '');

function Part({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className="text-xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Points({ items }: { items: ReadonlyArray<string> }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** Label and value pairs; a value with an address is a link, a value still to be given is marked. */
function Details({
  rows,
}: {
  rows: ReadonlyArray<readonly [label: string, value: string, href?: string]>;
}) {
  return (
    <dl className="uf-privacy-details">
      {rows.map(([label, value, href]) => (
        <div key={label}>
          <dt className="font-medium">{label}</dt>
          <dd>{href ? <a href={href}>{value}</a> : <Fill value={value} />}</dd>
        </div>
      ))}
    </dl>
  );
}
