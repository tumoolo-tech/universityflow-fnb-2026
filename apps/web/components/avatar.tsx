import { tokens } from '@universityflow/tokens';
import {
  type AvatarId,
  type IconId,
  type IconShape,
  initials,
  LOOK_ICON_STROKE,
  LOOK_ICON_VIEWBOX,
  LOOK_ICONS,
  type ThemeId,
} from '@universityflow/ui';
import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './icons';

/**
 * The learner's avatar and theme colours (docs/design/profile-look-proposal.md): initials, an
 * icon or a pattern, on the theme's accent. Decoration only (`aria-hidden`): the learner's name is
 * always said beside it.
 */

const cssVar = (token: string) =>
  `var(--uf-color-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)})`;

/** The theme as the two custom properties the card and the avatar read. */
export function lookStyle(theme: ThemeId): CSSProperties {
  const { accent, soft } = tokens.profileThemes[theme];
  return { '--look-accent': cssVar(accent), '--look-soft': cssVar(soft) } as CSSProperties;
}

/** One shape of an icon, from the drawings the web and the app share (packages/ui). */
function Shape({ shape }: { shape: IconShape }) {
  if (shape.kind === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} />;
  if (shape.kind === 'rect')
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} />;
  return <path d={shape.d} />;
}

export function LookIcon({ id, className }: { id: IconId; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={LOOK_ICON_VIEWBOX}
      fill="none"
      stroke="currentColor"
      strokeWidth={LOOK_ICON_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-1/2'}
    >
      {LOOK_ICONS[id].map((shape, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a shape's place in its drawing is its identity
        <Shape key={i} shape={shape} />
      ))}
    </svg>
  );
}

/**
 * `marker` tells the card's avatar from the picker's tiles. Initials without a name show a plain
 * person icon instead.
 */
export function Avatar({
  avatar,
  name,
  marker,
  className,
}: {
  avatar: AvatarId;
  name: string | null;
  marker: 'card' | 'tile' | 'home';
  className?: string;
}) {
  const [kind, id] = avatar.split(':') as ['initials' | 'icon' | 'pattern', string | undefined];
  const letters = kind === 'initials' ? initials(name) : null;
  let inside: ReactNode = null;
  if (kind === 'icon') inside = <LookIcon id={id as IconId} />;
  else if (kind === 'initials')
    inside = letters ?? <Icon name="person" className="size-1/2 shrink-0" />;
  return (
    <span
      data-avatar={marker}
      aria-hidden="true"
      className={['uf-avatar', kind === 'pattern' ? `uf-pattern-${id}` : '', className ?? '']
        .filter(Boolean)
        .join(' ')}
    >
      {inside}
    </span>
  );
}
