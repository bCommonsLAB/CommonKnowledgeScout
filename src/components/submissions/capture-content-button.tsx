/**
 * @fileoverview „Inhalte erfassen"-Button fuer Galerie/Erkunden (ADR-0004 II; U6).
 *
 * @description
 * Rechte-gateter Einstieg in die Erfassung. Sichtbar nur fuer
 * `owner`/`co-creator`/`contributor` — die Berechtigung kommt serverseitig aus
 * `GET /api/libraries/[id]/me/capture`. Seit U6 fuehrt der Button NICHT mehr in
 * einen Inline-Upload-Dialog, sondern in den **generischen Erfassungs-Wizard**
 * (`/library/create/<wizard>`): erklaeren → hochladen → Inhaltstyp waehlen →
 * berechnen → pruefen → in den Wartekorb. Erfassung laeuft off-target ueber die
 * Inbox; der Ziel-Provider wird NIE beruehrt (ADR-0004).
 *
 * @see src/app/library/create/[typeId]/page.tsx (Wizard-Route)
 * @see docs/wizards/umbauplan-generischer-erfassungs-wizard.md (U6)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Generischer Erfassungs-Wizard (Datei-Upload + Inhaltstyp-Wahl, off-target).
 * Als `typeId` der Wizard-Route; der Flow ist medien-agnostisch (PDF/Audio).
 */
const CAPTURE_WIZARD_TYPE_ID = 'file-transcript-de';

export interface CaptureContentButtonProps {
  libraryId?: string;
}

export function CaptureContentButton({ libraryId }: CaptureContentButtonProps) {
  const router = useRouter();
  const [canCapture, setCanCapture] = useState(false);

  // Erfass-Berechtigung serverseitig pruefen; bei Fehler fail-closed (Button verborgen).
  useEffect(() => {
    if (!libraryId) {
      setCanCapture(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/libraries/${encodeURIComponent(libraryId)}/me/capture`, {
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => null)) as { canCapture?: boolean } | null;
        if (!cancelled) setCanCapture(res.ok && data?.canCapture === true);
      } catch {
        // Bewusst fail-closed: kein Recht sichtbar machen, wenn die Pruefung scheitert.
        if (!cancelled) setCanCapture(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [libraryId]);

  if (!libraryId || !canCapture) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0"
      // from=gallery: der Zurück-Link im Wizard führt zurück nach Erkunden
      // (Einstieg war die Galerie), nicht in die Wizard-Auswahl.
      onClick={() => router.push(`/library/create/${CAPTURE_WIZARD_TYPE_ID}?from=gallery`)}
    >
      <FilePlus2 className="mr-2 h-4 w-4" />
      Inhalte erfassen
    </Button>
  );
}
