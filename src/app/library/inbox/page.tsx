/**
 * @fileoverview Wartekorb (Inbox-Abnahme) als eigener Library-Bereich (ADR-0004, Stufe B).
 *
 * @description
 * Eigener Bereich neben Archiv/Galerie (Route `/library/inbox`): listet die
 * Submissions der aktiven Library und erlaubt die Abnahme (Story-Vorschau +
 * Korrektur + Freigeben/Ablehnen). Reine Server-Schale; die Logik liegt im
 * Client-Teil, in `<Suspense>` (wegen `useSearchParams`).
 *
 * @see docs/wizards/abnahme-inbox-plan.md
 * @see docs/adr/0004-capture-publish-entkopplung-inbox-modell.md
 */

import { Suspense } from 'react';
import { InboxClient } from './inbox-client';

export default function InboxPage() {
  return (
    <div className="flex h-full flex-col overflow-hidden px-6 pb-6 pt-0 lg:px-4">
      <div className="min-h-0 flex-1">
        <Suspense fallback={<div className="flex h-full items-center justify-center">Lade Wartekorb…</div>}>
          <InboxClient />
        </Suspense>
      </div>
    </div>
  );
}
