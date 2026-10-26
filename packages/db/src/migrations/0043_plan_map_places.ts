/**
 * Migration 0043: where each card of a plan map sits on its canvas (RT-08, the owner's live
 * run-through, 2026-10-25: "make things movable so users can move them and structure them how
 * they want"). Append-only. Phase 6e moves to 0044.
 *
 * A map's name (RT-06) needs no column: `plan_maps.title` (0030) holds it, with its words gate and
 * its personal-number check. Maps written before this keep a null title, shown as the template's
 * name, and the learner is asked to name them; nothing is copied into the database for them.
 */
export const sql = `-- A card's place on the canvas: the top-left corner of the centre or of a stop (depth 0 or 1),
-- in the canvas's own pixels at 100%, both numbers or neither. None (null) means where the
-- template puts it, worked out from the cards' sizes in the browser, so every card written before
-- this stays where it was. Numbers only, never words: it needs consent (row-level security, as
-- every plan map row), not the words switch. The bounds are the store's (PLAN_POSITION_MAX).
alter table plan_map_nodes
  add column place_x smallint,
  add column place_y smallint;
alter table plan_map_nodes add constraint plan_map_nodes_canvas_place check (
  (place_x is null and place_y is null)
  or (
    place_x is not null and place_y is not null
    and place_x between 0 and 4000 and place_y between 0 and 4000
    and depth <= 1
  )
);
`;
