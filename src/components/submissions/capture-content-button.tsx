/**
 * @fileoverview „Inhalte erfassen"-Button fuer Galerie/Erkunden (ADR-0004 II; U6).
 *
 * @description
 * Rechte-gateter Einstieg in die Erfassung. Sichtbar nur fuer
 * `owner`/`co-creator`/`contributor` — die Berechtigung kommt serverseitig aus
 * `GET /api/libraries/[id]/me/capture`. Der Button fuehrt in die **kuratierte
 * Wizard-Uebersicht** (`/library/create`, W-F/Δ2b) — nicht mehr direkt in EINEN
 * hartkodierten Wizard. Dort waehlt der Nutzer aus den pro Library kuratierten
 * Wizards (W-B/W-C). Erfassung laeuft off-target ueber die Inbox; der
 * Ziel-Provider wird NIE beruehrt (ADR-0004).
 *
 * @see src/app/library/create/[typeId]/page.tsx (Wizard-Route)
 * @see docs/wizards/umbauplan-generischer-erfassungs-wizard.md (U6)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilePlus2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      // from=gallery: die Übersicht reicht es an den gewählten Wizard weiter,
      // damit dessen Zurück-Link nach Erkunden (Galerie) führt.
      onClick={() => router.push('/library/create?from=gallery')}
    >
      <FilePlus2 className="mr-2 h-4 w-4" />
      Inhalte erfassen
    </Button>
  );
}
