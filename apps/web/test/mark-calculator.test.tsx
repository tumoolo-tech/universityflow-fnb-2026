// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FieldSource, ResolvedScheme } from '@universityflow/admissions';
import { common, moduleCard } from '@universityflow/content';
import { calculatorWords } from '@universityflow/ui';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkCalculator } from '../components/mark-calculator';

/**
 * The module card's mark calculator in the browser (Phase 6c): typing marks updates the result at
 * once with no request; the summary is in a polite live region; a scheme with no pass mark shows
 * no "needed to pass" number at all; a rounded-up mark says so; a bad mark is marked on its field;
 * only "Save my marks" sends anything, and it is a form a keyboard submits. Synthetic schemes.
 */

const c = moduleCard.calculator;
const source: FieldSource = { level: 'outline', academicYear: 2027, draft: false };

const SCHEME: ResolvedScheme = {
  universityId: 'uj',
  moduleCode: 'DEMO1001',
  academicYear: 2027,
  weighting: {
    value: {
      components: [
        { name: 'Test 1', kind: 'test', weight: 15 },
        { name: 'Test 2', kind: 'test', weight: 15 },
        { name: 'Assignment', kind: 'assignment', weight: 10 },
        { name: 'Final examination', kind: 'exam', weight: 60, subminimum: 40 },
      ],
    },
    source,
  },
  passMark: { value: 50, source: { ...source, level: 'university' } },
  examAdmission: { value: { minimumYearMark: 40, conditions: [] }, source },
  examSubminimum: { value: 40, source },
  otherRules: [],
  includesDrafts: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(
  scheme: ResolvedScheme = SCHEME,
  marks = [{ component: 'Assignment', attempt: 1, percent: 70 }],
) {
  const fetch = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetch);
  render(
    <MarkCalculator
      scheme={scheme}
      words={calculatorWords()}
      initial={{ marks, target: null }}
      saveUrl="/api/modules/r1/DEMO1001"
      sample={false}
      savingLabel={common.saving}
    />,
  );
  return fetch;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('the mark calculator', () => {
  it('starts from the saved marks and works the result out as the learner types, with no request', () => {
    const fetch = show();
    expect((screen.getByLabelText(c.markLabel('Assignment')) as HTMLInputElement).value).toBe('70');
    type(c.markLabel('Test 1'), '60');
    type(c.markLabel('Test 2'), '70');
    type(c.targetLabel, '60');
    const target = screen.getByTestId('calculator-target');
    // 26.5 of 40 points in: 60% needs 55.83 in the exam, shown as 56 and labelled.
    expect(within(target).getByText(c.needed(56))).toBeTruthy();
    expect(within(target).getByText(c.roundedUp('55.8'))).toBeTruthy();
    expect(screen.getByTestId('calculator-dp').textContent).toContain(
      c.dp.met(c.admissionTerm, 40),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens a keyboard that can type “18/24” on a mark field: a phone’s decimal pad has no “/” (A7-24)', () => {
    show();
    for (const name of ['Test 1', 'Test 2', 'Assignment']) {
      const field = screen.getByLabelText(c.markLabel(name));
      expect(field.getAttribute('inputmode'), name).toBe('text');
      // Nothing "corrects" or capitalises a score as it is typed.
      expect(field.getAttribute('autocorrect'), name).toBe('off');
      expect(field.getAttribute('autocapitalize'), name).toBe('off');
      expect(field.getAttribute('spellcheck'), name).toBe('false');
    }
    // The target is a percentage only: the decimal pad is right for it.
    expect(screen.getByLabelText(c.targetLabel).getAttribute('inputmode')).toBe('decimal');
  });

  it('announces what changed in a polite live region', () => {
    show();
    const live = screen.getByTestId('calculator-summary');
    expect(live.getAttribute('aria-live')).toBe('polite');
    type(c.markLabel('Test 1'), '60');
    type(c.markLabel('Test 2'), '70');
    expect(live.textContent).toContain(c.yearMarkSoFar('66.3'));
  });

  it('shows no “needed to pass” number at all when the pass mark isn’t published (gotcha 40)', () => {
    const { passMark: _p, ...rest } = SCHEME;
    show(rest as ResolvedScheme);
    type(c.markLabel('Test 1'), '60');
    const pass = screen.getByTestId('calculator-pass');
    expect(pass.textContent).toBe(`${c.passTitle}${c.passNotPublished}`);
    expect(pass.textContent).not.toMatch(/\d/);
  });

  it('marks a bad mark on its field once the learner leaves it, and works nothing out', () => {
    show();
    const field = screen.getByLabelText(c.markLabel('Test 1'));
    fireEvent.change(field, { target: { value: '101' } });
    fireEvent.blur(field);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(c.markInvalid)).toBeTruthy();
    expect(
      within(screen.getByTestId('calculator-result')).getAllByText(c.fixFirst).length,
    ).toBeGreaterThan(0);
  });

  it('saves the typed marks and target with the keyboard (a form submit), and says so', async () => {
    const fetch = show();
    type(c.markLabel('Test 1'), '18/24');
    type(c.targetLabel, '60');
    fireEvent.submit(
      screen.getByRole('button', { name: c.save }).closest('form') as HTMLFormElement,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/modules/r1/DEMO1001');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({
      marks: [
        { component: 'Test 1', attempt: 1, percent: 75 },
        { component: 'Assignment', attempt: 1, percent: 70 },
      ],
      target: 60,
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(c.saved));
  });

  it('says it can’t work anything out when the weighting isn’t published', () => {
    const { weighting: _w, ...rest } = SCHEME;
    show(rest as ResolvedScheme, []);
    expect(screen.queryByRole('button', { name: c.save })).toBeNull();
    expect(screen.getAllByText(c.noWeighting).length).toBeGreaterThan(0);
  });
});
