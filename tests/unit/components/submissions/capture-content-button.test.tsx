// @vitest-environment jsdom
/**
 * Tests fuer den „Inhalte erfassen"-Button (ADR-0004 II, Welle II-A + III):
 * - Sichtbarkeit NUR bei canCapture=true (contributor/co-creator/owner).
 * - Nach erfolgreichem Upload wird die Stufe-B-Analyse angestossen (Welle III).
 * Fetch + Toast sind gemockt.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CaptureContentButton } from '@/components/submissions/capture-content-button';

const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ toast: toastMock }));

function mockCapture(canCapture: boolean): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ canCapture, role: canCapture ? 'contributor' : null }),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
});
afterEach(cleanup);

it('zeigt den Button, wenn der User erfassen darf', async () => {
  mockCapture(true);
  render(<CaptureContentButton libraryId="lib-1" />);
  expect(await screen.findByRole('button', { name: /Inhalte erfassen/i })).toBeTruthy();
  expect(global.fetch).toHaveBeenCalledWith('/api/libraries/lib-1/me/capture', { cache: 'no-store' });
});

it('rendert nichts, wenn der User nicht erfassen darf', async () => {
  mockCapture(false);
  const { container } = render(<CaptureContentButton libraryId="lib-1" />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  expect(screen.queryByRole('button', { name: /Inhalte erfassen/i })).toBeNull();
  expect(container.firstChild).toBeNull();
});

it('rendert nichts und prueft nicht ohne libraryId', () => {
  global.fetch = vi.fn() as unknown as typeof fetch;
  const { container } = render(<CaptureContentButton />);
  expect(container.firstChild).toBeNull();
  expect(global.fetch).not.toHaveBeenCalled();
});

it('stoesst nach erfolgreichem Upload die Analyse an (Welle III)', async () => {
  const fetchMock = vi
    .fn()
    // 1) Capture-Berechtigung
    .mockResolvedValueOnce({ ok: true, json: async () => ({ canCapture: true, role: 'contributor' }) })
    // 2) Upload -> pending Submission
    .mockResolvedValueOnce({ ok: true, json: async () => ({ submission: { id: 'sub-1' } }) })
    // 3) Analyse-Start
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'accepted', jobId: 'job-1' }) });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<CaptureContentButton libraryId="lib-1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Inhalte erfassen/i }));

  const input = (await screen.findByLabelText(/PDF-Datei/i)) as HTMLInputElement;
  const file = new File(['%PDF-1.4'], 'Quelle.pdf', { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: /Hochladen/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock.mock.calls[2][0]).toBe('/api/submissions/sub-1/analyze');
  expect(toastMock).toHaveBeenCalledWith(
    expect.objectContaining({ title: expect.stringContaining('Analyse gestartet') }),
  );
});

it('meldet einen fehlgeschlagenen Analyse-Start sichtbar (Submission bleibt erhalten)', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ canCapture: true, role: 'contributor' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ submission: { id: 'sub-1' } }) })
    .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ error: 'Keine analysierbare Quelle' }) });
  global.fetch = fetchMock as unknown as typeof fetch;

  render(<CaptureContentButton libraryId="lib-1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Inhalte erfassen/i }));

  const input = (await screen.findByLabelText(/PDF-Datei/i)) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['%PDF-1.4'], 'Quelle.pdf', { type: 'application/pdf' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: /Hochladen/i }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(toastMock).toHaveBeenCalledWith(
    expect.objectContaining({
      title: expect.stringContaining('Analyse nicht gestartet'),
      description: 'Keine analysierbare Quelle',
      variant: 'destructive',
    }),
  );
});
