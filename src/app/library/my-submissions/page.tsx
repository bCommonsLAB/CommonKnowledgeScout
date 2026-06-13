/**
 * @fileoverview „Meine Beitraege" — Contributor-Pruef-Sicht (ADR-0004 II, Welle III-4b).
 *
 * @description
 * Eigener Bereich, in dem der Erfasser SEINE eigenen Submissions sieht und das
 * Analyse-Ergebnis prueft/korrigiert (Stufe B) — OHNE Freigabe/Ablehnung (das
 * bleibt dem Reviewer im Wartekorb). Reine Server-Schale; Logik im Client-Teil,
 * in `<Suspense>` (wegen `useSearchParams`).
 *
 * @see docs/wizards/contributor-pdf-upload-wizard.md (Stufe B)
 */

import { Suspense } from 'react';
import { MySubmissionsClient } from './my-submissions-client';

export default function MySubmissionsPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden px-6 pb-6 pt-0 lg:px-4">
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center">Lade Beitraege…</div>}>
          <MySubmissionsClient />
        </Suspense>
      </div>
    </div>
  );
}
