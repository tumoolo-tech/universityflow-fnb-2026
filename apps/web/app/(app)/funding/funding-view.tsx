'use client';

import type { Nsfas } from '@universityflow/catalogue';
import { common, funding } from '@universityflow/content';
import { useState } from 'react';
import { FundingCard } from '@/components/funding-card';
import { Card, Checkbox, Notice, Page } from '@/components/ui';
import { api } from '@/lib/client/api';
import { fundingWindow } from '@/lib/funding-window';

/**
 * `draft` comes from the server: the provenance rule is the catalogue's, and its zod stays
 * out of the browser (audit A4-02). So does `today`, the day in South Africa, so the days left
 * are the server's count, the same on every screen.
 */
export function FundingView({
  nsfas,
  draft,
  done: initial,
  today,
}: {
  nsfas: Nsfas;
  draft: boolean;
  done: string[];
  /** YYYY-MM-DD in South Africa (`sastDateOf`). */
  today: string;
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
      {/* RT-05: the deadline first, the facts to scan, Apply as the primary button, N+ behind a disclosure. */}
      <FundingCard
        title={funding.nsfas}
        academicYear={nsfas.academicYear}
        draft={draft}
        window={fundingWindow(nsfas, today)}
        facts={[
          { text: funding.threshold(common.rand(nsfas.incomeThresholdZar)) },
          { text: funding.thresholdDisability(common.rand(nsfas.incomeThresholdDisabilityZar)) },
          { lead: funding.sassa, text: nsfas.sassaNote },
        ]}
        applyUrl={nsfas.applyUrl}
        sourceUrl={nsfas.sourceUrl}
        detail={{ title: funding.nPlus, body: nsfas.nPlusRule }}
      />
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
