import type { SafetyAdviceKind } from '@universityflow/catalogue';

/**
 * A university's safety note as the campus tour and the first-week checklist show it (planning.md
 * §11, Phase 5e-3): the university's words and dates from a checked record, and the lines to call.
 * Never a severity and never a map zone. Types only (hard rule 11).
 */

/** A number to call beside a note: campus security (verified only) or an emergency line. */
export interface SafetyCallLine {
  readonly id: string;
  /** Whose number it is, as the record names it ("Protection Services", "South African Police Service"). */
  readonly name: string;
  /** The campus a security line is on; null for a national emergency line. */
  readonly campusName: string | null;
  /** As printed; dial it with `dialable`. */
  readonly phone: string;
}

export interface SafetyNoteView {
  readonly id: string;
  readonly kind: SafetyAdviceKind;
  /** The university's exact words. */
  readonly quote: string;
  /** An area in the university's own words, or null. */
  readonly area: string | null;
  readonly days: string | null;
  readonly hours: string | null;
  /** The date the university's page prints, or null when it prints none. */
  readonly publishedOn: string | null;
  /** When a person checked it against the page ("Last checked"); null for a draft (preview). */
  readonly checkedOn: string | null;
  readonly sourceUrl: string;
  /** True while unverified: preview only, labelled. */
  readonly draft: boolean;
  /** The verified campus security lines for it: never empty, or the note isn't shown. */
  readonly security: ReadonlyArray<SafetyCallLine>;
  /**
   * The police (10111) and the emergency line from a cell phone (112), from the catalogue's
   * helplines as the view returns them: never empty, or the note isn't shown.
   */
  readonly emergency: ReadonlyArray<SafetyCallLine>;
}
