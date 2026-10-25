import type { Curriculum } from '../curriculum';

/**
 * University of Johannesburg (UJ): first-year curricula, one record per programme and
 * rule-book year (planning.md §11, Phase 5c).
 *
 * Fill this array only: the catalogue already reads it, and the catalogue tests validate every
 * record added here. Schema and field notes: `packages/catalogue/src/curriculum.ts`.
 * - `programmeId` is an id from data/uj.ts; `sourceUrl` is the faculty rule book or
 *   programme page on uj.ac.za; `academicYear` is the year the rule book is for.
 * - Modules as printed (code, name, semester, credits, compulsory). Electives are modules with
 *   `compulsory: false`, named in an elective group. Credit totals as published.
 * - Never add `verifiedOn`/`verifiedBy`: a person does. A programme with no published
 *   first-year curriculum gets no record.
 */

export const ujCurricula: Curriculum[] = [];
