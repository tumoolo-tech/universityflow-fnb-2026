'use client';

import type { Nsfas } from '@universityflow/catalogue';
import { applications, common, funding } from '@universityflow/content';
import { useState } from 'react';
import { Badge, ButtonLink, Card, Checkbox, Notice, Page, SourceLink } from '@/components/ui';
import { api, formatDate } from '@/lib/client/api';

/**
 * `draft` comes from the server: the provenance rule is the catalogue's, and its zod stays
 * out of the browser (audit A4-02).
 */
export function FundingView({
  nsfas,
  draft,
  done: initial,
}: {
  nsfas: Nsfas;
  draft: boolean;
  done: string[];
}) {
  const [done, setDone] = useState(new Set(initial));

  async function tick(item: string, value: boolean) {
    setDone((set) => {
      const copy = new Set(set);
      if (value) copy.add(item);
      else copy.delete(item);
      return copy;
    });
    await api('/api/checklist', {
      method: 'POST',
      json: { scope: 'funding:nsfas', item, done: value },
    });
  }

  return (
    <Page title={funding.title} lead={funding.lead}>
      <Notice tone="warning">{funding.free}</Notice>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg">{funding.nsfas}</h2>
          <Badge>{nsfas.academicYear}</Badge>
          {draft ? <Badge tone="warning">{common.draftBadge}</Badge> : null}
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-bold">{funding.window}</h3>
          <p>
            {nsfas.opensOn ? `${applications.opens(formatDate(nsfas.opensOn))} · ` : ''}
            {nsfas.closesOn ? applications.closes(formatDate(nsfas.closesOn)) : common.unknown}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-bold">{funding.who}</h3>
          <ul className="list-disc pl-6">
            <li>{funding.threshold(common.rand(nsfas.incomeThresholdZar))}</li>
            <li>{funding.thresholdDisability(common.rand(nsfas.incomeThresholdDisabilityZar))}</li>
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-bold">{funding.sassa}</h3>
          <p>{nsfas.sassaNote}</p>
        </div>
        <div className="flex flex-col gap-1">
          <h3 className="font-bold">{funding.nPlus}</h3>
          <p>{nsfas.nPlusRule}</p>
        </div>
        {/* The page's one action, in the outline look; the source beside it (A2-22). */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ButtonLink href={nsfas.applyUrl} variant="secondary" newTab>
            {funding.apply}
            <span className="sr-only"> {common.opensInNewTab}</span>
          </ButtonLink>
          <SourceLink href={nsfas.sourceUrl} row />
        </div>
      </Card>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">{funding.documents}</h2>
          <p className="text-sm text-muted">{funding.checklistScope}</p>
        </div>
        <ul className="flex flex-col gap-1">
          {nsfas.documents.map((doc, i) => {
            const item = `document-${i}`;
            return (
              <li key={item}>
                <label htmlFor={`nsfas-${item}`} className="flex min-h-11 items-start gap-3 py-2.5">
                  {/* On the first line of a long label, never squeezed by it. */}
                  <Checkbox
                    id={`nsfas-${item}`}
                    className="mt-0.5"
                    checked={done.has(item)}
                    onChange={(e) => tick(item, e.target.checked)}
                  />
                  <span>{doc}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </Card>
    </Page>
  );
}
