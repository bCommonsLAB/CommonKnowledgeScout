// @vitest-environment jsdom
/**
 * Tests fuer den „Inhalte erfassen"-Button (ADR-0004 II; U6):
 * - Sichtbarkeit NUR bei canCapture=true (contributor/co-creator/owner).
 * - Klick navigiert in den generischen Erfassungs-Wizard (kein Inline-Upload mehr).
 * Fetch + Router sind gemockt.
 */

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CaptureContentButton } from '@/components/submissions/capture-content-button';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function mockCapture(canCapture: boolean): void {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ canCapture, role: canCapture ? 'contributor' : null }),
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockClear();
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

it('navigiert beim Klick in die kuratierte Wizard-Uebersicht (W-F)', async () => {
  mockCapture(true);
  render(<CaptureContentButton libraryId="lib-1" />);
  fireEvent.click(await screen.findByRole('button', { name: /Inhalte erfassen/i }));
  expect(push).toHaveBeenCalledWith('/library/create?from=gallery');
});
