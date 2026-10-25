import { en } from '@universityflow/content/app';
import type { UniversityOption } from '../lib/types';
import { Body, Card, Radio, RadioGroup } from './ui';

/**
 * Choose a university to look around (Phase 5b), for My campus and First week. A set of radios
 * with the one shown selected: the pressed choice stays where it was, so a screen reader's focus
 * has somewhere to stay, and its state says what is shown (A3-16). The screen announces the
 * change once the new university has loaded.
 */
export function UniversityChooser({
  options,
  current,
  hasChoice,
  onChoose,
}: {
  options: ReadonlyArray<UniversityOption>;
  current: string | null;
  hasChoice: boolean;
  onChoose: (id: string) => void;
}) {
  return (
    <Card testID="university-chooser">
      <RadioGroup label={hasChoice ? en.campus.another : en.campus.chooseTitle} pair="card">
        {hasChoice ? null : (
          <Body pair="cardMuted" small>
            {en.campus.chooseLead}
          </Body>
        )}
        {options.map((o) => (
          <Radio
            key={o.id}
            label={en.campus.choose(o.name)}
            selected={o.id === current}
            onPress={() => {
              if (o.id !== current) onChoose(o.id);
            }}
          />
        ))}
      </RadioGroup>
    </Card>
  );
}
