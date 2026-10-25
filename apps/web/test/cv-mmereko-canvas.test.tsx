// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { cvMmereko } from '@universityflow/content';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MmerekoCanvas } from '../app/(app)/cv/mmereko-canvas';
import { MMEREKO_FRAME_SANDBOX } from '../lib/mmereko-canvas';

/**
 * "Open Mmereko" on My CV (2026-10-24): a real button opens a full-screen modal dialog over the
 * page; focus moves into it and returns to the button; Esc and Close shut it; the page behind
 * doesn't scroll; "Open in a new tab" is always there. The frame loads only once opened, with a
 * narrow sandbox, no referrer and nothing about the learner in its address.
 */

const LOGIN = 'https://mmereko.tumoolo.tech/login';
const SITE = 'https://mmereko.tumoolo.tech/';

// jsdom has no modal dialogs: the browser's showModal/close, as far as this component needs them.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  document.documentElement.style.overflow = '';
});

function renderCanvas() {
  return render(<MmerekoCanvas copy={cvMmereko} loginUrl={LOGIN} siteUrl={SITE} />);
}

function opener(): HTMLElement {
  return screen.getByRole('button', { name: cvMmereko.open });
}

async function openIt(): Promise<HTMLDialogElement> {
  await fireEvent.click(opener());
  const dialog = document.querySelector('dialog');
  if (!dialog) throw new Error('no dialog');
  return dialog;
}

describe('MmerekoCanvas', () => {
  it('starts closed: a real button, and no frame until it is pressed (nothing loads from Mmereko)', () => {
    const { container } = renderCanvas();
    expect(opener().tagName).toBe('BUTTON');
    expect(opener().getAttribute('type')).toBe('button');
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('opens as a labelled dialog, moves focus into it, and holds the page still', async () => {
    renderCanvas();
    const dialog = await openIt();
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(screen.getByRole('dialog', { name: cvMmereko.title })).toBe(dialog);
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: cvMmereko.close }));
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(dialog.textContent).toContain(cvMmereko.separate);
  });

  it('frames Mmereko’s sign-in only, sandboxed, with no referrer and nothing about the learner', async () => {
    renderCanvas();
    const dialog = await openIt();
    const frame = dialog.querySelector('iframe');
    expect(frame?.getAttribute('src')).toBe(LOGIN);
    expect(frame?.getAttribute('title')).toBe(cvMmereko.frameTitle);
    expect(frame?.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(frame?.getAttribute('sandbox')?.split(' ').sort()).toEqual(
      [
        'allow-scripts',
        'allow-forms',
        'allow-same-origin',
        'allow-popups',
        'allow-popups-to-escape-sandbox',
        'allow-downloads',
        'allow-storage-access-by-user-activation',
      ].sort(),
    );
    expect(frame?.getAttribute('sandbox')).toBe(MMEREKO_FRAME_SANDBOX);
    expect(frame?.getAttribute('sandbox')).not.toContain('allow-top-navigation');
    expect(frame?.getAttribute('allow')).toBe('clipboard-write');
  });

  it('always offers a new tab and Mmereko’s own site, each opening safely', async () => {
    renderCanvas();
    await openIt();
    const tab = screen.getByRole('link', { name: cvMmereko.newTab });
    expect(tab.getAttribute('href')).toBe(LOGIN);
    expect(tab.getAttribute('target')).toBe('_blank');
    expect(tab.getAttribute('rel')).toBe('noopener noreferrer');
    const site = screen.getByRole('link', { name: cvMmereko.siteLink });
    expect(site.getAttribute('href')).toBe(SITE);
    expect(site.getAttribute('target')).toBe('_blank');
    expect(site.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('Close shuts it, drops the frame, gives the page its scroll back and focus to the button', async () => {
    renderCanvas();
    const dialog = await openIt();
    await fireEvent.click(screen.getByRole('button', { name: cvMmereko.close }));
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(dialog.querySelector('iframe')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener());
  });

  it('Esc shuts it too, focus back on the button', async () => {
    renderCanvas();
    const dialog = await openIt();
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener());
    // The browser's own Esc (a `cancel` event) is handled the same way.
    const again = await openIt();
    await fireEvent(again, new Event('cancel', { cancelable: true }));
    expect(again.hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener());
  });
});
