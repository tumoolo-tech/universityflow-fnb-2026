import 'server-only';
import { type CatalogueView, programmeById, universityById } from '@universityflow/catalogue';
import { profileLook } from '@universityflow/content';
import type { PlanMapRecord, PlanNodeRecord, StudentStore } from '@universityflow/db';
import {
  isPlanTemplateId,
  PLAN_LIMITS,
  type PlanGoal,
  type PlanMapSummary,
  type PlanMapsResponse,
  type PlanMapView,
  type PlanNode,
  type PlanTemplateId,
  planCounts,
  resolveLook,
  slotWords,
} from '@universityflow/ui';
import { HttpError } from './http';
import { getServices } from './services';

/**
 * My plan maps for the web pages and the app's API (docs/design/plan-maps-proposal.md §3.2): the
 * learner's maps as the shared `packages/ui` shapes. The middle, when linked, shows My goal read
 * live from the catalogue the learner may see (§4): nothing about a course is kept in the map,
 * and a course they may not see is never named.
 */

/** Whether learners may write their own words now: the owner's switch (D2). */
export async function planWordsAllowed(): Promise<boolean> {
  return (await getServices()).config.mindmapWords;
}

export function toPlanNode(r: PlanNodeRecord): PlanNode {
  return {
    id: r.id,
    parentId: r.parentId,
    position: r.position,
    depth: r.depth,
    slotId: r.slotId,
    text: r.text,
    status: r.status,
    whyNot: r.whyNot,
    differently: r.differently,
    targetMonth: r.targetMonth,
    place: r.place,
  };
}

/** The course and university in the middle, read live (§4), or why there is none. */
export function planGoal(programmeId: string | null, view: CatalogueView): PlanGoal {
  if (!programmeId) return { kind: 'none' };
  const programme = programmeById(view, programmeId);
  const university = programme ? universityById(view, programme.universityId) : undefined;
  if (!programme || !university) return { kind: 'unavailable' };
  return { kind: 'goal', course: programme.name, university: university.name };
}

/**
 * The learner's About me words (their profile's badges, fixed words from `en.profileLook`), read
 * live for the middle of the picture (the spec's "three words"): never stored in the map.
 */
export async function aboutMeWords(student: StudentStore): Promise<string[]> {
  const profile = await student.profile();
  if (!profile) return [];
  const badges = profileLook.badges as Record<string, string>;
  return resolveLook(profile).badgeIds.flatMap((id) => badges[id] ?? []);
}

export async function planMapView(
  student: StudentStore,
  view: CatalogueView,
  map: PlanMapRecord,
  wordsAllowed: boolean,
): Promise<PlanMapView> {
  if (!isPlanTemplateId(map.templateId)) throw new HttpError(404, 'not-found');
  return {
    id: map.id,
    templateId: map.templateId,
    title: map.title,
    linksGoal: map.linksGoal,
    goal: map.linksGoal ? planGoal((await student.goal())?.programmeId ?? null, view) : null,
    nodes: map.nodes.map(toPlanNode),
    wordsAllowed,
    updatedAt: map.updatedAt.toISOString(),
    words: await aboutMeWords(student),
  };
}

export function planMapSummary(map: PlanMapRecord): PlanMapSummary | null {
  if (!isPlanTemplateId(map.templateId)) return null;
  return {
    id: map.id,
    templateId: map.templateId,
    title: map.title,
    counts: planCounts(map.nodes.map(toPlanNode)),
    updatedAt: map.updatedAt.toISOString(),
  };
}

export async function planMapsResponse(student: StudentStore): Promise<PlanMapsResponse> {
  const maps = await student.planMaps();
  return {
    maps: maps.flatMap((m) => planMapSummary(m) ?? []),
    wordsAllowed: await planWordsAllowed(),
    max: PLAN_LIMITS.maps,
  };
}

/** The learner's map, or 404: another learner's map is simply not there. */
export async function ownMap(student: StudentStore, id: string): Promise<PlanMapRecord> {
  const map = await student.planMap(id);
  if (!map || !isPlanTemplateId(map.templateId)) throw new HttpError(404, 'not-found');
  return map;
}

/**
 * What a part's words were written under, for the crisis check (D3): a template stop's heading,
 * or, for the learner's own part, its own words.
 */
export function headingOf(
  templateId: PlanTemplateId,
  node: Pick<PlanNodeRecord, 'slotId' | 'text'>,
): string | null {
  return slotWords(templateId, node.slotId)?.heading ?? node.text;
}
