// @vitest-environment jsdom
/**
 * Tests fuer den „Inhalte erfassen"-Button (ADR-0004 II, Welle II-A):
 * Der Button ist NUR sichtbar, wenn die Server-Pruefung canCapture=true liefert
 * (Erfolgskriterium contributor/co-creator/owner). Fetch + Toast sind gemockt.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { CaptureContentButton } from '@/components/submissions/capture-content-button';

vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));

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
