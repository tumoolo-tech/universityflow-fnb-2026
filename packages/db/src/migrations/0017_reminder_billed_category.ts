/**
 * Migration 0017: the category WhatsApp billed a message as (A12-09). We submit every template as
 * "utility"; Meta can recategorise one as "marketing" (about 12 times the price) and says so in
 * its status reports. Recording it per message keeps cost reporting true. A word only, never
 * anything about the learner; WhatsApp only. Append-only.
 *
 * Numbered 0017 to follow 0016, which another branch adds (status.md gotcha 36): renumber at merge
 * if the order changes.
 */
export const sql = `alter table reminders add column billed_category text
  check (billed_category in ('utility', 'marketing'));
alter table reminders add constraint reminders_billed_category_whatsapp
  check (billed_category is null or channel = 'whatsapp');
`;
