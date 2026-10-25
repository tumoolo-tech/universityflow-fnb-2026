import 'server-only';
import { planMaps } from '@universityflow/content';
import {
  allSlots,
  CENTRE_SLOT,
  PLAN_LINKS,
  PLAN_TEMPLATE_IDS,
  type PlanLinkId,
  type PlanTemplateId,
  planTemplate,
  slotWords,
} from '@universityflow/ui';

/**
 * My plan maps' words for the browser, as plain strings (the launch standard: a client component
 * receives its copy as props, and a prop must be serialisable). Each sentence that takes values
 * is sent as a template with `{0}`, `{1}`… in their places, made by calling the content's own
 * function with those markers, so the words stay packages/content's (hard rule 8). The client
 * fills them with `fill` (components/plan-maps/fill.ts).
 */

type Words<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => string
    ? string
    : T[K] extends string
      ? string
      : Words<T[K]>;
};

const MARKERS = ['{0}', '{1}', '{2}'] as const;

function asTemplates<T extends object>(value: T): Words<T> {
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      typeof v === 'function'
        ? (v as (...args: unknown[]) => string)(...MARKERS)
        : typeof v === 'object' && v !== null
          ? asTemplates(v)
          : v,
    ]),
  ) as Words<T>;
}

const { templates: _templates, consentDraft: _draft, ...words } = planMaps;

export type PlanCopy = Words<typeof words> & {
  /** `deleteAsk` for a part with nothing under it, and with one step under it. */
  readonly deleteAskNone: string;
  readonly deleteAskOne: string;
};

/** Every word the card and the map page use, the templates' aside. */
export function planCopy(): PlanCopy {
  return {
    ...asTemplates(words),
    deleteAskNone: planMaps.deleteAsk('{0}', 0),
    deleteAskOne: planMaps.deleteAsk('{0}', 1),
  };
}

/** The picker's line for each template: its name and what it is. */
export type TemplateChoices = ReadonlyArray<{
  readonly id: PlanTemplateId;
  readonly name: string;
  readonly line: string;
}>;

export function templateChoices(): TemplateChoices {
  return PLAN_TEMPLATE_IDS.map((id) => ({
    id,
    name: planMaps.templates[id].name,
    line: planMaps.templates[id].line,
  }));
}

/** A template stop's words for the map page, with the page that computes its facts (§6). */
export interface SlotCopy {
  readonly heading: string;
  readonly hint: string;
  readonly subtitle: string | null;
  readonly childHint: string | null;
  readonly link: { readonly href: string; readonly label: string } | null;
}

/** One template's name and every stop's words, keyed by slot id (`slot:<key>`). */
export interface TemplateCopy {
  readonly name: string;
  readonly slots: Readonly<Record<string, SlotCopy>>;
}

export function templateCopy(id: PlanTemplateId): TemplateCopy {
  const link = (l: PlanLinkId | undefined) =>
    l ? { href: PLAN_LINKS[l], label: planMaps.links[l] } : null;
  const one = (slotId: string, linkId?: PlanLinkId): [string, SlotCopy] => {
    const w = slotWords(id, slotId);
    return [
      slotId,
      {
        heading: w?.heading ?? '',
        hint: w?.hint ?? '',
        subtitle: w?.subtitle ?? null,
        childHint: w?.childHint ?? null,
        link: link(linkId),
      },
    ];
  };
  return {
    name: planMaps.templates[id].name,
    slots: Object.fromEntries([
      one(CENTRE_SLOT),
      ...allSlots(planTemplate(id)).map((s) => one(`slot:${s.key}`, s.link)),
    ]),
  };
}
