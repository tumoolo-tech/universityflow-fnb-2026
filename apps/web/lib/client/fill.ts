/**
 * Fills a sentence sent as a template (`{0}`, `{1}`…, lib/server/plan-maps-copy.ts) with its
 * values, in order. A marker with no value is left out.
 */
export function fill(template: string, ...values: ReadonlyArray<string | number>): string {
  return template.replace(/\{(\d)\}/g, (_, i: string) => String(values[Number(i)] ?? ''));
}
