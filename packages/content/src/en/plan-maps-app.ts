/**
 * `en.planMapsApp`: the phone app's own words for My plan maps (the owner's run-through,
 * 2026-10-25, RT-06): a map carries the learner's own name and the template is only its layout;
 * the outline's hub says how far they are. The map's shared words stay in `en.planMaps`
 * (packages/content plan-maps.ts). Stage names only, no admission fact (hard rule 2,
 * plan-maps-app.test.ts); every string owed the owner's wording review.
 */
export const planMapsApp = {
  // ── Naming a map (RT-06): the learner's own words, so it waits with them (D2) ───────────────
  naming: {
    label: 'Name your map',
    hint: 'A name of your own, like “My road to engineering”. The template is only how it’s laid out.',
    needed: 'Give your map a name to start it.',
    /** Under a map's name: which template lays it out. */
    layout: (template: string) => `Layout: ${template}`,
    rename: 'Rename map',
    /** The rename button's full name for a screen reader: which map it renames. */
    renameFor: (name: string) => `Rename map: ${name}`,
    saveName: 'Save name',
    renamed: 'Map renamed.',
    /** On a map made before maps had names: it shows its template's name until it gets one. */
    unnamed: 'This map doesn’t have a name of its own yet.',
    nameThis: 'Name this map',
  },

  // ── The hub at the top of the outline: the learner's summary ───────────────────────────────
  hub: {
    progress: (achieved: number, total: number) => `${achieved} of ${total} achieved`,
    /** The learner's About me words, read live from their profile (never kept in the map). */
    words: 'My words',
  },
} as const;
