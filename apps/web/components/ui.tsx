import { common } from '@universityflow/content';
import Link from 'next/link';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { useId } from 'react';

/**
 * The few building blocks every screen uses. Touch targets are at least 44px, every field has a
 * visible label, and errors are announced (WCAG 2.2 AA, hard rule 9).
 */

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

/**
 * The one button look, shared by `Button`, `ButtonLink` and `FileButton` (A2-18), so a fix to it
 * reaches all three. Nothing outside this file spells it out (test/primitives.test.tsx, for the
 * filled and the outline look, A2-22). Exported for the rare control that must stay a plain
 * element: a download from an API route (an `<a>` Next mustn't route) or a "Start" inside a
 * link that is a whole card.
 */
export const buttonLook = (variant: Variant) =>
  cx(
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-medium transition-colors',
    variant === 'primary' && 'bg-brand text-on-brand hover:bg-brand-hover',
    // Calm on dark: a neutral outline, the accent only on hover, focus and when pressed.
    variant === 'secondary' &&
      'border-thick border-line-strong bg-surface text-ink hover:border-brand hover:bg-sunk focus-visible:border-brand aria-pressed:border-brand aria-[current=page]:border-brand',
    variant === 'quiet' && 'text-brand underline underline-offset-4 hover:bg-sunk',
    variant === 'danger' && 'bg-danger text-on-brand',
  );

/** `ComponentProps` (not just the attributes): a ref passes through, to move focus to it. */
type ButtonProps = ComponentProps<'button'> & { variant?: Variant };

export function Button({ variant = 'primary', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        buttonLook(variant),
        // `aria-disabled` looks the same as `disabled` but keeps keyboard focus (A3-01).
        'disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A link that looks like a button: an app path goes through Next's `Link`; `tel:`, `sms:`,
 * `mailto:` and other addresses are a plain `<a>`. Links are underlined in text (WCAG 1.4.1);
 * a filled or outlined button isn't, and the quiet one keeps its underline.
 */
export function ButtonLink({
  href,
  variant = 'primary',
  className,
  children,
  'aria-label': label,
  'aria-describedby': describedBy,
  newTab,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
  /** A fuller name than the visible text, e.g. the place a number calls (WCAG 2.4.4). */
  'aria-label'?: string | undefined;
  /** A hint, e.g. what a maps link sends (only the destination). */
  'aria-describedby'?: string | undefined;
  /**
   * Opens another site in a new tab (`target="_blank"`), sending it no referrer and no handle on
   * this page (`rel="noopener noreferrer"`): the maps links (Phase 5e-1).
   */
  newTab?: boolean;
}) {
  const props = {
    className: cx(buttonLook(variant), variant !== 'quiet' && 'no-underline', className),
    ...(label ? { 'aria-label': label } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
  };
  return href.startsWith('/') ? (
    <Link href={href} {...props}>
      {children}
    </Link>
  ) : (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

/**
 * A file picker that looks and behaves like a button: the visible label is the control's name,
 * the input stays in the page (visually hidden) for the keyboard and screen readers. While its
 * input is `disabled` or `aria-disabled` the label looks busy, and it shows the focus ring, with
 * the global 2px offset, when the input has keyboard focus.
 */
export function FileButton({
  label,
  variant = 'primary',
  className,
  ...input
}: Omit<ComponentProps<'input'>, 'type' | 'className'> & {
  label: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <label
      className={cx(
        buttonLook(variant),
        'cursor-pointer',
        'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[[aria-disabled=true]]:cursor-not-allowed has-[[aria-disabled=true]]:opacity-60',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2',
        className,
      )}
    >
      {label}
      <input type="file" className="sr-only" {...input} />
    </label>
  );
}

/**
 * A checkbox in the brand colour, at the size the goals and messages boxes use, keeping its size
 * in a narrow row (A3-20). Busy: pass `aria-disabled`, never `disabled`, so it keeps focus (A3-12).
 */
export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cx(
        'size-5 shrink-0 accent-brand disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string | undefined;
  error?: string | null | undefined;
  /**
   * `describedBy` names the hint and the error; `invalid` goes on the control as `aria-invalid`,
   * so the error is tied to the field it is about (WCAG 3.3.1, A3-14).
   */
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: true | undefined;
  }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, describedBy, invalid: error ? true : undefined })}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputClass =
  'min-h-11 w-full rounded-md border-thick border-line-strong bg-surface px-3 py-2 text-base aria-[invalid=true]:border-danger';

export function Input(props: ComponentProps<'input'>) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<'select'>) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}

export function TextArea(props: ComponentProps<'textarea'>) {
  return <textarea {...props} className={cx(inputClass, 'min-h-24', props.className)} />;
}

export function Card({
  children,
  className,
  as: Tag = 'section',
  glow,
  tone,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'article' | 'div' | 'li';
  'aria-labelledby'?: string;
  /** A target for a link or a form's `#fragment` (My subjects' filter and what-if). */
  id?: string;
  /**
   * The home's headline card: the card with a soft mauve glow (globals.css `.uf-glow-card`,
   * GLASS_PAIRS haze over surface) in place of the plain surface (A2-23).
   */
  glow?: boolean;
  /**
   * `warning`: a notice with a heading of its own (the judge demo's "made-up details"), the same
   * shape as every card on the status's soft ground (TEXT_PAIRS: ink on warningSoft).
   */
  tone?: 'warning' | undefined;
}) {
  // The fill, edge and shadow are `.uf-card`'s (globals.css, RT-04), not utilities: a utility
  // beats every `@layer components` rule, so a `bg-surface` here would keep a card inside a card
  // its parent's colour. The warning tone's utilities win on purpose.
  return (
    <Tag
      className={cx(
        'uf-card rounded-lg border',
        tone === 'warning' ? 'border-warning bg-warning-soft text-ink' : null,
        tone !== 'warning' && glow ? 'uf-glow-card' : null,
        'p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * A tile inside a card (a subject in Free practice, a plan map in My plan maps, the goal's course,
 * the course picker): the sunk fill and an edge of its own (`.uf-panel`, the tokens' `cardEdge`
 * at 3:1 on the card, RT-04), so it reads as one thing inside its card. Every panel takes this
 * look; none is typed by hand (test/card-separation.test.tsx). A neutral badge inside one is
 * `tone="surface"` (A2-07).
 */
export const panelLook = 'uf-panel rounded-md bg-sunk';

/** The space between sibling cards in a list or a grid (tokens.card.gap, RT-04). */
export const cardListGap = 'gap-(--uf-card-gap)';

export function Badge({
  tone = 'neutral',
  children,
}: {
  /** `surface`: the neutral badge for a sunk panel, where `neutral` would vanish (A2-07). */
  tone?: 'neutral' | 'surface' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-3 py-0.5 text-sm font-medium',
        tone === 'neutral' && 'bg-sunk text-ink',
        tone === 'surface' && 'bg-surface text-ink',
        tone === 'success' && 'bg-success-soft text-success',
        tone === 'warning' && 'bg-warning-soft text-warning',
        tone === 'danger' && 'bg-danger-soft text-danger',
        tone === 'info' && 'bg-info-soft text-info',
        tone === 'accent' && 'bg-accent text-on-accent',
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cx(
        'rounded-md border-l-rule p-4',
        tone === 'info' && 'border-info bg-info-soft',
        tone === 'warning' && 'border-warning bg-warning-soft',
        tone === 'danger' && 'border-danger bg-danger-soft',
        tone === 'success' && 'border-success bg-success-soft',
      )}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      <div className="text-ink">{children}</div>
    </div>
  );
}

/**
 * A link to an official source, opening in a new tab, saying so for screen readers. `context`
 * (a place's name) goes into the accessible name only, so a list of them can be told apart
 * (WCAG 2.4.9, A3-19). `row`: on its own in a row of buttons, not in running text, it gets the
 * full touch target (A3-20).
 */
export function SourceLink({
  href,
  children,
  context,
  row,
}: {
  href: string;
  children?: ReactNode;
  context?: string;
  row?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cx('text-sm', row && 'inline-flex min-h-11 items-center')}
    >
      {children ?? common.officialSource}
      {context ? <span className="sr-only">: {context}</span> : null}
      <span className="sr-only"> {common.opensInNewTab}</span>
    </a>
  );
}

/**
 * A page's title and lead. No margin of its own: the space under it is `Page`'s gap, so it is the
 * same on every page (docs/design/README.md, "One rhythm"). Pages use `Page`, never this alone;
 * the home (components/dashboard.tsx) uses it beside its two icon links (A2-23).
 */
/** A page title's one look: every page's `h1`, signed in or public, at every width. */
export const titleLook = 'text-2xl sm:text-3xl';

export function PageHeader({
  title,
  lead,
  headingRef,
  titleId,
}: {
  /** Words, or words with a highlighted part (the home's welcome with the learner's name). */
  title: ReactNode;
  lead?: string | undefined;
  /** For a page that moves focus to its heading when its view changes (A3-13). */
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** The title's id, for a section or form labelled by it (`aria-labelledby`). */
  titleId?: string | undefined;
}) {
  return (
    <header className="flex flex-col gap-2">
      <h1
        id={titleId}
        className={titleLook}
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
      >
        {title}
      </h1>
      {lead ? <p className="max-w-prose text-muted">{lead}</p> : null}
    </header>
  );
}

/**
 * Every titled page: the header, then its parts one gap apart, the same gap under the title as
 * between the parts (the home's rhythm). Held by test/page-rhythm.test.ts.
 */
export function Page({
  title,
  lead,
  headingRef,
  titleId,
  children,
}: {
  title: string;
  lead?: string | undefined;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** The title's id, for a section or form labelled by it. */
  titleId?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} lead={lead} headingRef={headingRef} titleId={titleId} />
      {children}
    </div>
  );
}

/** The widths a page without the sidebar may take (tokens.maxWidth), and its footer with it. */
export type PublicWidth = 'prose' | 'wide' | 'page';
export const publicWidth: Record<PublicWidth, string> = {
  prose: 'max-w-prose',
  wide: 'max-w-wide',
  page: 'max-w-page',
};

/**
 * Every page without the sidebar (Get help, the privacy policy, a guardian's consent, onboarding,
 * the judge demo's pages): the main landmark, centred at a token width, with one gutter (16px,
 * 24px from `sm`), one space above and below, an optional brand line, and its parts one `gap-6`
 * apart, as `Page` spaces a signed-in page. The split stage (the front door, sign-in) is its own
 * frame. `SiteFooter` takes the same `width`, so the footer lines up with the page above it.
 */
export function PublicPage({
  width = 'prose',
  brand,
  children,
}: {
  width?: PublicWidth;
  /** The app's name over the page, in ink like the sidebar's; a link when it has an address. */
  brand?: { readonly name: string; readonly href?: string } | undefined;
  children: ReactNode;
}) {
  // The same box with or without an address, so the title sits at the same height either way.
  const brandLook =
    'inline-flex min-h-11 items-center self-start text-lg font-bold text-ink no-underline';
  return (
    <main
      id="main"
      className={cx(
        'mx-auto flex w-full flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12',
        publicWidth[width],
      )}
    >
      {brand?.href ? (
        <Link href={brand.href} className={brandLook}>
          {brand.name}
        </Link>
      ) : brand ? (
        <p className={brandLook}>{brand.name}</p>
      ) : null}
      {children}
    </main>
  );
}

/**
 * A page's live status line ("Saved.", "Removed."). While it says nothing it takes no space, so
 * an empty one never adds a second gap under the title; it stays in the page, so what it says
 * later is still announced. `ref` and `tabIndex` let a page move focus to it.
 *
 * `said` comes from `useStatus` (lib/client/status.ts): each outcome is drawn as a new line, even
 * with the same words as the last, so Save then Save again is announced twice (A2-51, WCAG 4.1.3).
 * Every page's status line speaks this way (test/status-line.test.tsx).
 */
export function StatusLine({
  said,
  children,
  ref,
  tabIndex,
}: {
  said?: { readonly text: string; readonly n: number } | undefined;
  children?: ReactNode;
  ref?: Ref<HTMLParagraphElement> | undefined;
  tabIndex?: number | undefined;
}) {
  // A new node for each outcome (its key is the count): the region announces an addition.
  const line = said?.text ? <span key={said.n}>{said.text}</span> : null;
  return (
    <p role="status" className="font-medium empty:sr-only" ref={ref} tabIndex={tabIndex}>
      {said ? line : children}
    </p>
  );
}

/**
 * The one way a page says it has nothing to show yet, as the home's empty cards do: a card with
 * one muted sentence and, when the next step isn't already on the page, one outline button to it.
 */
export function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: { href: string; label: string } | undefined;
}) {
  return (
    <Card as="div" className="flex flex-col items-start gap-4">
      <p className="text-muted">{children}</p>
      {action ? (
        <ButtonLink href={action.href} variant="secondary">
          {action.label}
        </ButtonLink>
      ) : null}
    </Card>
  );
}

export { cx };
