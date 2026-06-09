/**
 * @fileoverview „Inhalte erfassen"-Button fuer Galerie/Erkunden (ADR-0004 II, Welle II-A).
 *
 * @description
 * Rechte-gateter Einstieg in die Erfassung (Stufe A: PDF-Upload). Sichtbar nur fuer
 * `owner`/`co-creator`/`contributor` — die Berechtigung kommt serverseitig aus
 * `GET /api/libraries/[id]/me/capture` (der Client-Atom kennt `contributor` nicht
 * zuverlaessig). Beim Absenden laedt `POST /api/submissions` (multipart) die Datei
 * ueber den Inbox-Provider in die Quarantaene und legt eine `pending`-Submission an,
 * die im Wartekorb erscheint. Der Ziel-Provider wird NIE beruehrt (ADR-0004).
 *
 * @see src/app/api/submissions/route.ts
 * @see docs/wizards/contributor-pdf-upload-wizard.md
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

// Stufe A erzeugt eine fixe Submission-Form (PDF -> Buchanalyse, noch keine Analyse).
const CAPTURE_DEFAULTS = { wizardId: 'pdf-upload', docType: 'pdfanalyse', detailViewType: 'book' };

export interface CaptureContentButtonProps {
  libraryId?: string;
}

export function CaptureContentButton({ libraryId }: CaptureContentButtonProps) {
  const [canCapture, setCanCapture] = useState(false);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSubmit(): Promise<void> {
    if (!file || !libraryId) return;
    setIsUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('libraryId', libraryId);
      form.set('wizardId', CAPTURE_DEFAULTS.wizardId);
      form.set('docType', CAPTURE_DEFAULTS.docType);
      form.set('detailViewType', CAPTURE_DEFAULTS.detailViewType);
      form.set('markdownBody', '');
      form.set('metadata', JSON.stringify({ title: file.name }));

      const res = await fetch('/api/submissions', { method: 'POST', body: form });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Upload fehlgeschlagen (HTTP ${res.status})`);
      }
      toast({ title: 'Beitrag erfasst', description: 'Dein PDF liegt jetzt im Wartekorb.' });
      setOpen(false);
      setFile(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unbekannter Fehler beim Upload');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <FilePlus2 className="mr-2 h-4 w-4" />
          Inhalte erfassen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inhalte erfassen</DialogTitle>
          <DialogDescription>
            PDF auswaehlen und hochladen. Der Beitrag landet im Wartekorb und wird dort geprueft.
            Schritt 2 — Metadaten pruefen &amp; korrigieren folgt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="capture-file">PDF-Datei</Label>
          <Input
            id="capture-file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              setError(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <Link href="/library/inbox" className="text-xs text-muted-foreground underline">
            Zum Wartekorb
          </Link>
          <Button onClick={() => void handleSubmit()} disabled={!file || isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Hochladen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
