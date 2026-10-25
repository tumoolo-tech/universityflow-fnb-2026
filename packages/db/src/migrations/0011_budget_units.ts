/**
 * Migration 0011: budgets charged by units (audits A1-14, A12-08). Append-only.
 */
export const sql = String.raw`-- An SMS is billed per segment, so one send can cost more than one unit: a three-segment SMS
-- takes three. Each event records what it cost; a budget sums the units in its window. Rows from
-- before this migration were one unit each, which the default keeps.
alter table budget_events
  add column units integer not null default 1,
  add constraint budget_events_units check (units between 1 and 100);
`;
