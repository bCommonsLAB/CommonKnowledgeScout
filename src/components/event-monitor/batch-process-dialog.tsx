'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, PlayCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Job, JobParameters } from '@/types/event-job';
import { processSession, ProcessSessionInput } from '@/lib/secretary/client';
import JSZip from 'jszip';
import { useAtom } from 'jotai';
import { activeLibraryAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: Job[];
}

export function BatchProcessDialog({ open, onOpenChange, jobs }: Props) {
  const [activeLibrary] = useAtom(activeLibraryAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const { provider } = useStorage();
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [idx, setIdx] = useState(0);
  const [errors, setErrors] = useState<Array<{ jobId: string; jobName: string; message: string }>>([]);
  const [successes, setSuccesses] = useState<Array<{ jobId: string; jobName: string }>>([]);
  const total = jobs.length;
  const progress = total ? (idx / total) * 100 : 0;
  const canRun = !!provider && !!activeLibrary && total > 0;

  // (entfernt) Vimeo Medien-Auflösung; nicht mehr benötigt, da Audio-Schritt entfällt

  // Hilfsfunktion: Verzeichnisstruktur anlegen und Ziel-Folder-ID für einen Pfad bestimmen
  const ensureDirectoryPath = async (targetPath: string): Promise<string> => {
    if (!provider) throw new Error('Kein Storage Provider verfügbar');
    // WICHTIG: Wenn ein Pfad mit Unterordnern angegeben ist, immer ab Library-Root beginnen,
    // sonst kommt es zu Verdopplungen (Pfad wird unter dem bereits gewählten Ordner erneut erzeugt).
    const libraryRootId = 'root';
    const baseRoot = targetPath && targetPath.includes('/') ? libraryRootId : (currentFolderId || libraryRootId);
    if (!targetPath || !targetPath.includes('/')) return baseRoot;
    const parts = targetPath.split('/').filter(Boolean);
    if (parts.length === 0) return baseRoot;
    const dirs = parts.slice(0, -1);
    let parent = baseRoot;
    for (const dir of dirs) {
      const items = await provider.listItemsById(parent);
      const existing = items.find(it => it.type === 'folder' && it.metadata.name === dir);
      if (existing) parent = existing.id; else {
        const created = await provider.createFolder(parent, dir);
        parent = created.id;
      }
    }
    return parent;
  };

  // VTT → Plaintext (einfach): entferne Header/Nummern/Zeitcodes, joine mit Space
  function vttToPlainText(vtt: string): string {
    return vtt
      .replace(/^WEBVTT.*$/gmi, '')
      .replace(/^\d+\s*$/gmi, '')
      .replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}.*$/gmi, '')
      .replace(/^-+$/gmi, '')
      .replace(/\r/g, '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function handleRun() {
    console.group('[BatchProcess] Start');
    console.info('[BatchProcess] Jobs:', jobs.length);
    if (!provider || !activeLibrary) {
      console.error('[BatchProcess] Abbruch: fehlende Umgebung', {
        hasProvider: !!provider,
        hasActiveLibrary: !!activeLibrary,
      });
      setErrors(prev => [...prev, { jobId: 'n/a', jobName: 'Umgebung', message: 'Keine aktive Library oder kein Storage-Provider verfügbar. Bitte auf der Library-Seite eine Library auswählen.' }]);
      setFinished(true);
      console.groupEnd();
      return;
    }
    setRunning(true);
    setFinished(false);
    setErrors([]);
    setSuccesses([]);
    try {
      console.time('[BatchProcess] Gesamtzeit');
      for (let i = 0; i < jobs.length; i++) {
        setIdx(i);
        const job = jobs[i];
        const p: JobParameters = job.parameters;
        console.groupCollapsed(`[BatchProcess] Job ${i + 1}/${jobs.length}: ${job.job_id}`);
        // Basispayload für Secretary; video_transcript wird ggf. ergänzt
        const payload: ProcessSessionInput = {
          event: p.event || '',
          session: p.session || (job.job_name || job.job_id),
          url: p.url || '',
          filename: p.filename || (p.session ? `${p.session}.md` : job.job_id + '.md'),
          track: p.track || (p.event ? `${p.event}-track` : 'track'),
          day: p.day,
          starttime: p.starttime,
          endtime: p.endtime,
          speakers: Array.isArray(p.speakers) ? p.speakers : undefined,
          // Video-URL MIT senden (Templates nutzen sie ggf. kontextuell);
          // Wenn video_transcript gesetzt ist, wird Videoverarbeitung serverseitig übersprungen.
          video_url: p.video_url,
          attachments_url: p.attachments_url,
          source_language: p.source_language || 'en',
          target_language: p.target_language || 'de',
          template: p.template || 'Session_analyze',
          use_cache: false,
          create_archive: true,
        };

        // Schritt A: Transcript laden (wenn möglich) und in Secretary-Payload einfügen
        let transcriptText: string | null = null;
        if (p.video_url) {
          try {
            const idMatch = String(p.video_url).match(/(?:player\.vimeo\.com\/video\/|vimeo\.com\/)(\d+)/);
            const body: { videoId: string } | { playerUrl: string } = idMatch ? { videoId: idMatch[1] } : { playerUrl: p.video_url };
            const tr = await fetch('/api/video/transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const tj: { status?: string; data?: { vtt?: string; track?: { id?: string; language?: string; kind?: string; name?: string; link?: string } } } = await tr.json();
            console.info('[BatchProcess] Transcript resolve (pre-Secretary)', { ok: tr.ok, track: tj?.data?.track });
            if (tr.ok && tj?.data?.vtt) {
              const plain = vttToPlainText(String(tj.data.vtt));
              transcriptText = plain;
            }
          } catch {}
          if (transcriptText) {
            payload.video_transcript = transcriptText;
            console.info('[BatchProcess] Transcript-Text gesetzt', { chars: transcriptText.length });
          } else {
            console.info('[BatchProcess] Kein Transcript-Text verfügbar (skip)');
          }
        }

        // Schritt B: Secretary mit ggf. video_transcript aufrufen (einmalig)
        try {
          console.info('[BatchProcess] Secretary processSession request', {
            event: payload.event,
            session: payload.session,
            url: payload.url,
            filename: payload.filename,
            track: payload.track,
            target_language: payload.target_language,
            has_video_url: !!payload.video_url,
            has_video_transcript: typeof payload.video_transcript === 'string',
            create_archive: payload.create_archive,
          });
          console.time('[BatchProcess] processSession');
          const respFinal = await processSession(payload);
          console.timeEnd('[BatchProcess] processSession');
          const outFinal = (respFinal && typeof respFinal === 'object' && 'data' in respFinal && respFinal.data && typeof respFinal.data === 'object' && 'output' in respFinal.data)
            ? (respFinal as { data: { output?: { archive_data?: string; archive_filename?: string; markdown_content?: string; markdown_file?: string } } }).data.output
            : undefined;
          console.debug('[BatchProcess] processSession response keys', outFinal ? Object.keys(outFinal) : []);

          if (outFinal?.archive_data && outFinal?.archive_filename) {
            console.info('[BatchProcess] ZIP vorhanden, entpacke und lade hoch', { filename: outFinal.archive_filename });
            const binary = atob(outFinal.archive_data);
            const buf = new Uint8Array(binary.length);
            for (let bi = 0; bi < binary.length; bi++) buf[bi] = binary.charCodeAt(bi);
            const zip = await JSZip.loadAsync(buf as unknown as ArrayBuffer);
            let markdownDir: string | null = null;
            for (const [name, entry] of Object.entries(zip.files)) {
              const e = entry as JSZip.JSZipObject;
              if (e.dir) continue;
              const fileData = await e.async('blob');
              const file = new File([fileData], name.split('/').pop() || name, { type: fileData.type || undefined });
              const folderId = await ensureDirectoryPath(name);
              console.debug('[BatchProcess] Upload Datei', { name, targetFolderId: folderId });
              await provider.uploadFile(folderId, file);
              if (!markdownDir && name.toLowerCase().endsWith('.md') && name.includes('/')) {
                const idx = name.lastIndexOf('/');
                markdownDir = idx > 0 ? name.substring(0, idx) : null;
              }
            }
            // Fallback: aus Response entnehmen, falls durch spätere README.md überschrieben
            if (!markdownDir && typeof outFinal?.markdown_file === 'string') {
              const mf: string = outFinal.markdown_file;
              const idx = mf.lastIndexOf('/');
              markdownDir = idx > 0 ? mf.substring(0, idx) : null;
            }
            console.info('[BatchProcess] Markdown-Verzeichnis ermittelt', { markdownDir, responsePath: outFinal?.markdown_file });
            // Wenn wir ein Transcript im Payload hatten, zusätzlich als .txt neben Markdown speichern
            if (payload.video_transcript && markdownDir) {
              const txt = new File([payload.video_transcript], 'auto_generated_captions.txt', { type: 'text/plain' });
              const folderId = await ensureDirectoryPath(markdownDir + '/auto_generated_captions.txt');
              console.info('[BatchProcess] Transcript-Datei hochladen (ZIP-Fall)', { targetDir: markdownDir, fileName: 'auto_generated_captions.txt', folderId });
              await provider.uploadFile(folderId, txt);
            } else {
              console.info('[BatchProcess] Transcript-Upload übersprungen (ZIP-Fall)', { hasTranscript: !!payload.video_transcript, markdownDir });
            }
            setSuccesses(prev => [...prev, { jobId: job.job_id, jobName: job.job_name || job.parameters?.session || job.job_id }]);
          } else if (outFinal?.markdown_content && outFinal?.markdown_file) {
            console.info('[BatchProcess] Nur Markdown vorhanden, lade hoch', { markdown_file: outFinal.markdown_file });
            const file = new File([outFinal.markdown_content], outFinal.markdown_file, { type: 'text/markdown' });
            const folderId = await ensureDirectoryPath(outFinal.markdown_file);
            console.debug('[BatchProcess] Upload Markdown', { targetFolderId: folderId, fileName: outFinal.markdown_file });
            await provider.uploadFile(folderId, file);
            if (payload.video_transcript) {
              const baseIdx = outFinal.markdown_file.lastIndexOf('/');
              const dir = baseIdx > 0 ? outFinal.markdown_file.substring(0, baseIdx) : '';
              const txt = new File([payload.video_transcript], 'auto_generated_captions.txt', { type: 'text/plain' });
              const tfId = await ensureDirectoryPath(dir ? dir + '/auto_generated_captions.txt' : 'auto_generated_captions.txt');
              console.info('[BatchProcess] Transcript-Datei hochladen (Markdown-Fall)', { targetDir: dir || '(root)', fileName: 'auto_generated_captions.txt', folderId: tfId });
              await provider.uploadFile(tfId, txt);
            } else {
              console.info('[BatchProcess] Transcript-Upload übersprungen (Markdown-Fall) – kein Transcript im Payload');
            }
            setSuccesses(prev => [...prev, { jobId: job.job_id, jobName: job.job_name || job.parameters?.session || job.job_id }]);
          } else {
            throw new Error('Secretary-Antwort ohne archive_data/markdown_content');
          }

          // Persistiere das Plaintext-Transcript zusätzlich in der Session-Collection (falls verfügbar)
          try {
            if (payload.video_transcript) {
              await fetch('/api/sessions/transcript', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event: payload.event,
                  session: payload.session,
                  url: payload.url,
                  filename: payload.filename,
                  transcript_text: payload.video_transcript
                })
              });
            }
          } catch {}
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error('[BatchProcess] Fehler bei processSession', { jobId: job.job_id, message, stack: err instanceof Error ? err.stack : undefined });
          setErrors(prev => [...prev, { jobId: job.job_id, jobName: job.job_name || job.parameters?.session || job.job_id, message }]);
        }

        // (entfernt) Optionaler Audio-Schritt
        console.groupEnd();
      }
    } finally {
      setRunning(false);
      setFinished(true);
      console.timeEnd('[BatchProcess] Gesamtzeit');
      console.table({ successes: successes.length, errors: errors.length, jobs: jobs.length });
      console.groupEnd();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!running) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch verarbeiten</DialogTitle>
          <DialogDescription>
            Führt pro Job einen Secretary-Lauf aus und lädt Markdown/Bilder in die aktuelle Library hoch.
          </DialogDescription>
        </DialogHeader>

        {running && (
          <div className="space-y-2">
            <Progress value={progress} />
            <div className="text-sm text-gray-600">{idx}/{total}</div>
          </div>
        )}

        {!running && !activeLibrary && (
          <div className="p-3 rounded border border-red-300 bg-red-50 text-sm text-red-800">
            Keine aktive Library ausgewählt. Bitte zuerst in der Library eine Bibliothek und ein Zielverzeichnis wählen.
          </div>
        )}

        {!running && activeLibrary && !provider && (
          <div className="p-3 rounded border border-amber-300 bg-amber-50 text-sm text-amber-800">
            Storage-Provider nicht verfügbar. Bitte Seite neu laden oder Library erneut wählen.
          </div>
        )}

        {!running && finished && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span>{successes.length} erfolgreich</span>
            </div>
            {errors.length > 0 && (
              <div className="p-3 rounded border border-amber-300 bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span className="text-sm font-medium text-amber-800">{errors.length} Fehler</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-auto text-xs">
                  {errors.map(e => (
                    <div key={e.jobId} className="border-l-2 border-amber-400 pl-2">
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-3 h-3 text-amber-700" />
                        <span className="font-medium">{e.jobName}</span>
                        <span className="text-gray-500">({e.jobId})</span>
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-amber-900">{e.message}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { if (!running) { onOpenChange(false); setFinished(false); setIdx(0); setErrors([]); setSuccesses([]); } }} disabled={running}>Schließen</Button>
          <Button onClick={handleRun} disabled={running || !jobs.length || !canRun}>
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlayCircle className="w-4 h-4 mr-2" />}
            Verarbeitung starten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


