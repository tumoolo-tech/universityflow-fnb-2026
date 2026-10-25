import { en } from '@universityflow/content/app';
import { useState } from 'react';
import { View } from 'react-native';
import { theme } from '../lib/theme';
import type { OffersResponse } from '../lib/types';
import { Body, Button, Field, Notice } from './ui';

/**
 * Choosing the course of an offer from the catalogue, by searching it: shared by "Add an offer"
 * and the letter's check form. The courses matched from a letter are offered first as buttons to
 * press, never chosen for the learner (A1-29): nothing is chosen until they choose.
 */

const MAX_OPTIONS = 20;

export function CourseChooser(props: {
  label: string;
  hint?: string | null;
  options: OffersResponse['options'];
  value: string | null;
  onChange: (programmeId: string) => void;
  /** Courses matched from a letter, offered first. */
  candidates?: ReadonlyArray<string>;
  error?: string | null;
}) {
  const t = en.offers;
  const [choosing, setChoosing] = useState(false);
  const [query, setQuery] = useState('');
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = props.options
    .filter((o) => words.every((w) => `${o.universityName} ${o.name}`.toLowerCase().includes(w)))
    .slice(0, MAX_OPTIONS);
  const chosen = props.options.find((o) => o.id === props.value) ?? null;
  const matched = (props.candidates ?? []).flatMap((id) =>
    props.options.filter((o) => o.id === id),
  );
  const choose = (id: string) => {
    props.onChange(id);
    setChoosing(false);
    setQuery('');
  };

  return (
    <View style={{ gap: theme.space['2'] }}>
      <Body pair="card" strong>
        {props.label}
      </Body>
      {props.hint ? (
        <Body pair="cardMuted" small>
          {props.hint}
        </Body>
      ) : null}
      {chosen && !choosing ? (
        <>
          <Body
            pair="card"
            testID="chosen-course"
          >{`${chosen.universityName}: ${chosen.name}`}</Body>
          <Button label={t.changeCourse} variant="quiet" onPress={() => setChoosing(true)} />
        </>
      ) : choosing ? (
        <View style={{ gap: theme.space['2'] }} testID="course-chooser">
          <Field
            label={en.goals.choose}
            hint={en.goals.chooseHint}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            testID="course-search"
          />
          {found.map((o) => (
            <Button
              key={o.id}
              variant="secondary"
              label={`${o.universityName}: ${o.name}`}
              onPress={() => choose(o.id)}
            />
          ))}
          <Button label={en.common.cancel} variant="quiet" onPress={() => setChoosing(false)} />
        </View>
      ) : (
        <>
          {matched.length > 0 ? (
            <View style={{ gap: theme.space['2'] }} testID="letter-candidates">
              {matched.map((o) => (
                <Button
                  key={o.id}
                  variant="secondary"
                  label={`${o.universityName}: ${o.name}`}
                  onPress={() => choose(o.id)}
                />
              ))}
            </View>
          ) : null}
          <Button label={t.chooseCourse} variant="secondary" onPress={() => setChoosing(true)} />
        </>
      )}
      {props.error ? <Notice tone="danger">{props.error}</Notice> : null}
    </View>
  );
}
