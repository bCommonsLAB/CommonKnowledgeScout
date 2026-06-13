/**
 * Tests fuer den Ergebnis-Rueckfluss Analyse-Job -> Submission (Welle III):
 * extractSubmissionIdFromJob + applyAnalysisResult (Frontmatter -> metadata,
 * Body -> markdownBody, Merge ueber Stufe-A-Platzhalter, explizite Fehler).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getSubmissionById: vi.fn(),
  updateSubmissionMetadata: vi.fn(),
}));

vi.mock('@/lib/repositories/wizard-submissions-repo', () => ({
  getSubmissionById: h.getSubmissionById,
  updateSubmissionMetadata: h.updateSubmissionMetadata,
}));

import {
  applyAnalysisResult,
  extractSubmissionIdFromJob,
} from '@/lib/submissions/submission-analysis';
import type { StorageProvider } from '@/lib/storage/types';

function providerWithMarkdown(markdown: string): StorageProvider {
  return {
    getBinary: vi.fn().mockResolvedValue({
      blob: new Blob([markdown], { type: 'text/markdown' }),
      mimeType: 'text/markdown',
    }),
  } as unknown as StorageProvider;
}

const TRANSFORMED = `---
title: "Echte Analyse"
author: "Anna"
---

# Kapitel 1

Inhalt.`;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('extractSubmissionIdFromJob', () => {
  it('liest correlation.options.submissionId', () => {
    expect(
      extractSubmissionIdFromJob({
        correlation: { jobId: 'j', libraryId: 'l', options: { submissionId: 'sub-1' } },
      }),
    ).toBe('sub-1');
  });

  it('liefert null fuer normale Archiv-Jobs (keine/leere submissionId)', () => {
    expect(extractSubmissionIdFromJob({ correlation: { jobId: 'j', libraryId: 'l' } })).toBeNull();
    expect(
      extractSubmissionIdFromJob({
        correlation: { jobId: 'j', libraryId: 'l', options: { submissionId: '  ' } },
      }),
    ).toBeNull();
    expect(
      extractSubmissionIdFromJob({
        correlation: { jobId: 'j', libraryId: 'l', options: { submissionId: 42 } },
      }),
    ).toBeNull();
  });
});

describe('applyAnalysisResult', () => {
  it('merged Frontmatter ueber Stufe-A-Metadata und setzt den Body', async () => {
    h.getSubmissionById.mockResolvedValue({
      id: 'sub-1',
      metadata: { title: 'Quelle.pdf', custom: 'bleibt' },
    });
    h.updateSubmissionMetadata.mockResolvedValue({ id: 'sub-1' });

    await applyAnalysisResult({
      submissionId: 'sub-1',
      savedItemId: 'lib-1/inbox/alice/.Quelle/Quelle.de.pdfanalyse.md',
      provider: providerWithMarkdown(TRANSFORMED),
    });

    expect(h.updateSubmissionMetadata).toHaveBeenCalledWith('sub-1', {
      // Analyse gewinnt je Feld; Stufe-A-Felder ohne Konflikt bleiben.
      metadata: { title: 'Echte Analyse', author: 'Anna', custom: 'bleibt' },
      markdownBody: expect.stringContaining('# Kapitel 1'),
    });
    const body = h.updateSubmissionMetadata.mock.calls[0][1].markdownBody as string;
    expect(body).not.toContain('---');
  });

  it('wirft, wenn die Submission fehlt', async () => {
    h.getSubmissionById.mockResolvedValue(null);
    await expect(
      applyAnalysisResult({
        submissionId: 'missing',
        savedItemId: 'x',
        provider: providerWithMarkdown(TRANSFORMED),
      }),
    ).rejects.toThrow(/Submission nicht gefunden/);
    expect(h.updateSubmissionMetadata).not.toHaveBeenCalled();
  });

  it('wirft bei leerem Artefakt (weder Frontmatter noch Body)', async () => {
    h.getSubmissionById.mockResolvedValue({ id: 'sub-1', metadata: {} });
    await expect(
      applyAnalysisResult({
        submissionId: 'sub-1',
        savedItemId: 'leer',
        provider: providerWithMarkdown('   \n  '),
      }),
    ).rejects.toThrow(/leer/);
    expect(h.updateSubmissionMetadata).not.toHaveBeenCalled();
  });

  it('reicht Repo-Fehler (z.B. nicht editierbar) ungefangen durch', async () => {
    h.getSubmissionById.mockResolvedValue({ id: 'sub-1', metadata: {} });
    h.updateSubmissionMetadata.mockRejectedValue(new Error('nicht editierbar'));
    await expect(
      applyAnalysisResult({
        submissionId: 'sub-1',
        savedItemId: 'x',
        provider: providerWithMarkdown(TRANSFORMED),
      }),
    ).rejects.toThrow(/nicht editierbar/);
  });
});
