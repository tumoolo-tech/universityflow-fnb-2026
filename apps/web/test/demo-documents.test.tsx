// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { en } from '@universityflow/content';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Judge demo mode's documents page (docs/deploy/demo.md): "Use a sample report" attaches one of
 * the generator's SAMPLE statements, and an upload the demo refuses says why.
 */

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const { DocumentsView } = await import('../app/(app)/documents/documents-view');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the documents page in demo mode', () => {
  it('offers "Use a sample report" in demo mode only', () => {
    render(<DocumentsView documents={[]} direct={false} demo />);
    expect(screen.getByRole('button', { name: en.demo.useSampleReport })).toBeTruthy();
    cleanup();
    render(<DocumentsView documents={[]} direct={false} />);
    expect(screen.queryByRole('button', { name: en.demo.useSampleReport })).toBeNull();
  });

  it('the button posts to /api/demo/sample-report', async () => {
    const fetch = vi.fn(async (_url: string, _init?: RequestInit) =>
      Response.json({
        documentId: 'd1',
        sample: true,
        draft: null,
      }),
    );
    vi.stubGlobal('fetch', fetch);
    render(<DocumentsView documents={[]} direct={false} demo />);
    fireEvent.click(screen.getByRole('button', { name: en.demo.useSampleReport }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(fetch.mock.calls[0]?.[0]).toBe('/api/demo/sample-report');
  });

  it('an upload the demo refuses shows the demo’s own sentence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'upload', detail: 'demo-sample-only' }, { status: 400 }),
      ),
    );
    render(<DocumentsView documents={[]} direct={false} demo />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'report.pdf', { type: 'application/pdf' })] },
    });
    expect((await screen.findByRole('alert')).textContent).toBe(en.demo.sampleOnly);
  });
});
