'use client';

import { onboarding, profileLook as t } from '@universityflow/content';
import {
  AVATAR_IDS,
  BADGE_IDS,
  type BadgeId,
  LOOK_POSTER,
  type ProfileLook as Look,
  MAX_BADGES,
  TAGLINE_IDS,
  type TaglineId,
  THEME_IDS,
} from '@universityflow/ui';
import { type CSSProperties, useId, useRef, useState } from 'react';
import { Avatar, lookStyle } from '@/components/avatar';
import { Icon } from '@/components/icons';
import { Button, Checkbox, Field, Notice, Select, StatusLine } from '@/components/ui';
import { api, errorMessage } from '@/lib/client/api';
import { useFocusAfter } from '@/lib/client/focus';
import { useStatus } from '@/lib/client/status';
import { PhotoFigure, ProfilePhoto } from './profile-photo';

/**
 * The About me card and "Make it yours" (docs/design/profile-look-proposal.md). Rendered on the
 * server like every client component, so the card is whole before any script runs; the picker
 * previews each choice on the card and stores nothing until Save (one PATCH). Only the learner
 * sees it. The animations are CSS (globals.css, "The profile card"), each off for reduced motion.
 */
export function ProfileLook({
  name,
  grade,
  initial,
  photo = null,
}: {
  name: string | null;
  /** The grade today, for the sticker; null past matric or before it is given. */
  grade: number | null;
  initial: Look;
  /**
   * The profile photo (profile-look-proposal §5.3): null when the server's switch is off, so no
   * photo is offered; otherwise its version, or null for none (the avatar shows). In a judge
   * demo, `samples`: the SAMPLE pictures to choose from, in place of a file; and `realUploads`
   * when the demo also takes the visitor's own photo (UF_DEMO_REAL_PHOTOS, a hackathon exception).
   */
  photo?: {
    version: string | null;
    samples?: ReadonlyArray<string>;
    realUploads?: 'copy' | 'account';
  } | null;
}) {
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const [look, setLook] = useState(initial);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useStatus();
  const [error, setError] = useState<string | null>(null);
  // Bumped on each save: the sticker's one wiggle.
  const [saves, setSaves] = useState(0);
  const [photoVersion, setPhotoVersion] = useState(photo?.version ?? null);
  // Save and Cancel hide the picker they sit in: focus goes back to its button, never to <body>
  // (WCAG 2.4.3, A2-28).
  const toggle = useRef<HTMLButtonElement>(null);
  const focusAfter = useFocusAfter();

  function choose(change: Partial<Look>) {
    setStatus('');
    setLook((current) => ({ ...current, ...change }));
  }

  function toggleWord(word: BadgeId) {
    const has = look.badgeIds.includes(word);
    if (!has && look.badgeIds.length >= MAX_BADGES) return;
    choose({ badgeIds: has ? look.badgeIds.filter((w) => w !== word) : [...look.badgeIds, word] });
  }

  async function save() {
    setError(null);
    try {
      await api('/api/me', { method: 'PATCH', json: look });
      setSaved(look);
      setSaves((n) => n + 1);
      setOpen(false);
      setStatus(t.saved);
      focusAfter(() => toggle.current);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  function cancel() {
    setLook(saved);
    setOpen(false);
    setError(null);
    focusAfter(() => toggle.current);
  }

  const full = look.badgeIds.length >= MAX_BADGES;
  const pictureKinds = [
    { heading: t.avatarKinds.initials, ids: AVATAR_IDS.filter((a) => a === 'initials') },
    { heading: t.avatarKinds.icons, ids: AVATAR_IDS.filter((a) => a.startsWith('icon:')) },
    { heading: t.avatarKinds.patterns, ids: AVATAR_IDS.filter((a) => a.startsWith('pattern:')) },
  ];
  const pictureName = (avatar: string) => {
    const [kind, key] = avatar.split(':');
    if (kind === 'icon') return t.icons[key as keyof typeof t.icons];
    if (kind === 'pattern') return t.patterns[key as keyof typeof t.patterns];
    return t.initialsLabel;
  };

  return (
    <section
      aria-labelledby={`${id}-name`}
      className="uf-look rounded-lg border border-line"
      style={lookStyle(look.theme)}
    >
      {/*
       * The poster (the owner's reference picture): the name, the grade, the words, the tagline
       * come first for a screen reader ("Thando. Grade 10. My words… "); the grid places them
       * round the figure. "Hello" and the line are decoration.
       */}
      <div className="uf-look-poster">
        <h2 id={`${id}-name`} className="uf-look-intro uf-look-rise">
          {name ? (
            <span aria-hidden="true" className="uf-look-im">
              {t.im}
            </span>
          ) : null}
          <span className="uf-look-name">{name ?? t.noName}</span>
        </h2>
        <div className="uf-look-figure">
          {photo && photoVersion ? (
            <PhotoFigure version={photoVersion} />
          ) : (
            <Avatar avatar={look.avatar} name={name} marker="card" className="uf-look-rise" />
          )}
          {grade ? (
            <p key={saves} className={`uf-look-sticker${saves > 0 ? ' uf-look-saved' : ''}`}>
              {onboarding.gradeOption(grade)}
            </p>
          ) : null}
        </div>
        {look.badgeIds.length > 0 ? (
          <ul aria-label={t.myWords} className="uf-look-chips">
            {look.badgeIds.map((word, i) => (
              <li key={word} className="uf-look-chip" style={{ '--i': i } as CSSProperties}>
                {t.badges[word]}
              </li>
            ))}
          </ul>
        ) : null}
        {look.taglineId ? (
          <p className="uf-look-tagline">
            {t.taglines[look.taglineId]}
            <Icon name="arrow" className="uf-look-tagline-arrow" />
          </p>
        ) : null}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox={LOOK_POSTER.helloViewBox}
          className="uf-look-hello"
        >
          <path id={`${id}-arc`} d={LOOK_POSTER.helloArc} fill="none" />
          <text>
            <textPath href={`#${id}-arc`} startOffset="50%" textAnchor="middle">
              {t.hello}
            </textPath>
          </text>
        </svg>
        {/* From the end of "Hello", round the figure and behind it, down to "I'm". */}
        <svg
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          fill="none"
          className="uf-look-curve"
        >
          <path className="uf-look-line" pathLength={1} d={LOOK_POSTER.line} />
          <path className="uf-look-line" pathLength={1} d={LOOK_POSTER.arrowhead} />
        </svg>
      </div>

      <div className="flex flex-col gap-3 px-5 pb-5">
        <Button
          ref={toggle}
          variant="secondary"
          className="self-start"
          aria-expanded={open}
          aria-controls={`${id}-picker`}
          onClick={() => (open ? cancel() : setOpen(true))}
        >
          {t.open}
        </Button>
        <StatusLine said={status} />
      </div>

      <div id={`${id}-picker`} hidden={!open} className="flex flex-col gap-5 px-5 pb-5">
        <p className="text-muted">{t.lead}</p>
        {error ? <Notice tone="danger">{error}</Notice> : null}

        {/* Saved at once, apart from the look's Save (it is a file, not a choice from a list). */}
        {photo ? (
          <ProfilePhoto
            version={photoVersion}
            onChange={setPhotoVersion}
            samples={photo.samples ?? null}
            realUploads={photo.realUploads ?? null}
          />
        ) : null}

        <div role="radiogroup" aria-labelledby={`${id}-theme`}>
          <p id={`${id}-theme`} className="mb-2 font-medium">
            {t.theme}
          </p>
          <div className="flex flex-wrap gap-3">
            {THEME_IDS.map((theme) => (
              <label key={theme} className="uf-look-option" style={lookStyle(theme)}>
                <input
                  type="radio"
                  name={`${id}-theme`}
                  className="sr-only"
                  checked={look.theme === theme}
                  onChange={() => choose({ theme })}
                />
                <span aria-hidden="true" className="uf-look-swatch" />
                <span className="text-sm">{t.themes[theme]}</span>
              </label>
            ))}
          </div>
        </div>

        <div role="radiogroup" aria-labelledby={`${id}-picture`}>
          <p id={`${id}-picture`} className="mb-2 font-medium">
            {t.avatar}
          </p>
          {pictureKinds.map((group) => (
            // The kind's heading names its pictures for a screen reader too (A2-33).
            <fieldset key={group.heading} className="mb-3">
              <legend className="mb-1 text-sm text-muted">{group.heading}</legend>
              <div className="flex flex-wrap gap-2">
                {group.ids.map((avatar) => (
                  <label key={avatar} className="uf-look-option uf-look-tile">
                    <input
                      type="radio"
                      name={`${id}-picture`}
                      className="sr-only"
                      checked={look.avatar === avatar}
                      onChange={() => choose({ avatar })}
                    />
                    <Avatar avatar={avatar} name={name} marker="tile" className="size-11" />
                    <span className="sr-only">{pictureName(avatar)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <Field label={t.tagline}>
          {({ id: selectId }) => (
            <Select
              id={selectId}
              value={look.taglineId ?? ''}
              onChange={(e) =>
                choose({ taglineId: e.target.value ? (e.target.value as TaglineId) : null })
              }
            >
              <option value="">{t.taglineNone}</option>
              {TAGLINE_IDS.map((tagline) => (
                <option key={tagline} value={tagline}>
                  {t.taglines[tagline]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <fieldset>
          <legend className="mb-1 font-medium">{t.words}</legend>
          <p className="mb-2 text-sm text-muted">
            {t.wordsHint}{' '}
            <span aria-live="polite">{t.wordsChosen(look.badgeIds.length, MAX_BADGES)}</span>
          </p>
          {full ? (
            <p id={`${id}-full`} className="mb-2 text-sm">
              {t.wordsFull(MAX_BADGES)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {BADGE_IDS.map((word) => {
              const chosen = look.badgeIds.includes(word);
              const blocked = full && !chosen;
              return (
                <label key={word} htmlFor={`${id}-${word}`} className="uf-look-word">
                  {/* Full: `aria-disabled`, never `disabled`, so the box keeps focus and its reason is read (A3-12). */}
                  <Checkbox
                    id={`${id}-${word}`}
                    checked={chosen}
                    aria-disabled={blocked}
                    aria-describedby={blocked ? `${id}-full` : undefined}
                    onChange={() => toggleWord(word)}
                  />
                  <span>{t.badges[word]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save}>{t.save}</Button>
          <Button variant="quiet" onClick={cancel}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </section>
  );
}
