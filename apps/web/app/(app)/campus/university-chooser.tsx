import { en } from '@universityflow/content';
import { Button, Card, Select } from '@/components/ui';
import type { UniversityOption } from '@/lib/server/campus';

/**
 * Choose a university to look around (Phase 5b): a dropdown and one button (owner's request,
 * 2026-10-21; it was a button per university). A plain GET form (`?university=`), rendered on the
 * server, so it works without JavaScript. Shared by My campus and First week; one per page, so
 * its field has a fixed id.
 */
export function UniversityChooser({
  path,
  options,
  current,
  hasTour,
}: {
  path: '/campus' | '/first-week';
  options: ReadonlyArray<UniversityOption>;
  current: string | null;
  hasTour: boolean;
}) {
  const id = 'choose-university';
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg">{hasTour ? en.campus.another : en.campus.chooseTitle}</h2>
      {hasTour ? null : <p className="text-muted">{en.campus.chooseLead}</p>}
      <form action={path} method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-60 flex-1 flex-col gap-1">
          <label htmlFor={id} className="font-medium">
            {en.campus.universityLabel}
          </label>
          <Select id={id} name="university" required defaultValue="">
            <option value="" disabled>
              {en.common.chooseOne}
            </option>
            {options
              .filter((o) => o.id !== current)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          {en.campus.lookAround}
        </Button>
      </form>
    </Card>
  );
}
