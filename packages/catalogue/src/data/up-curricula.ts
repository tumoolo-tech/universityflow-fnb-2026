import type { Curriculum } from '../curriculum';

/**
 * University of Pretoria (UP): first-year curricula, one record per programme and
 * rule-book year (planning.md §11, Phase 5c).
 *
 * Fill this array only: the catalogue already reads it, and the catalogue tests validate every
 * record added here. Schema and field notes: `packages/catalogue/src/curriculum.ts`.
 * - `programmeId` is an id from data/up.ts; `sourceUrl` is the faculty rule book or
 *   programme page on up.ac.za; `academicYear` is the year the rule book is for.
 * - Modules as printed (code, name, semester, credits, compulsory). Electives are modules with
 *   `compulsory: false`, named in an elective group. Credit totals as published.
 * - Never add `verifiedOn`/`verifiedBy`: a person does. A programme with no published
 *   first-year curriculum gets no record.
 *
 * EMPTY on purpose (researched 2026-10-16): UP publishes its curricula only in the online
 * yearbooks (www.up.ac.za/yearbooks/2026/...), and www.up.ac.za refused automated access
 * (Cloudflare, HTTP 403), including the yearbooks' PDF exports. No other official file found
 * lists the first-year modules, so no curriculum is drafted from memory or search snippets. A
 * person opens the 2026 yearbook in a browser and fills these in.
 */

export const upCurricula: Curriculum[] = [];
