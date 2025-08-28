import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileSystemProvider } from '@/lib/storage/filesystem-provider';
import { ImageExtractionService } from '@/lib/transform/image-extraction-service';
import { TransformService } from '@/lib/transform/transform-service';
import { LibraryService } from '@/lib/services/library-service';
import { FileLogger } from '@/lib/debug/logger';
import type { Library } from '@/types/library';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { bufferLog, drainBufferedLogs } from '@/lib/external-jobs-log-buffer';
import { bumpWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

function toAsciiKebab(input: unknown, maxLen: number = 80): string | undefined {
  if (typeof input !== 'string') return undefined;
  const map: Record<string, string> = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
  const replaced = input
    .trim()
    .toLowerCase()
    .split('')
    .map(ch => map[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
  const cut = replaced.slice(0, maxLen).replace(/-+$/g, '');
  return cut || undefined;
}

function splitToArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const arr = value
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  if (typeof value === 'string') {
    const arr = value
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    return Array.from(new Set(arr));
  }
  return undefined;
}

function normalizeStructuredData(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...r };

  // shortTitle variants
  const shortTitleCandidate = (r['shortTitle'] ?? r['shortTitel'] ?? r['shortTitlel']) as unknown;
  if (typeof shortTitleCandidate === 'string') {
    const cleaned = shortTitleCandidate.replace(/[.!?]+$/g, '').trim();
    out['shortTitle'] = cleaned.length > 40 ? cleaned.slice(0, 40) : cleaned;
  }
  delete out['shortTitel'];
  delete out['shortTitlel'];

  // slug normalization
  const slug = toAsciiKebab(r['slug']);
  if (slug) out['slug'] = slug;

  // authors and tags arrays
  const authors = splitToArray(r['authors']);
  if (authors) out['authors'] = authors;
  const tags = splitToArray(r['tags']);
  if (tags) {
    const norm = tags
      .map(t => toAsciiKebab(t, 80) || '')
      .filter(Boolean) as string[];
    out['tags'] = Array.from(new Set(norm));
  }

  // year number
  const yearVal = r['year'];
  if (typeof yearVal === 'string' && /^\d{4}$/.test(yearVal)) out['year'] = Number(yearVal);

  return out;
}

interface OneDriveAuthConfig {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
}

async function ensureOneDriveAccessToken(lib: Library): Promise<string> {
  const cfg = lib.config as unknown as OneDriveAuthConfig | undefined;
  const accessToken = cfg?.accessToken as string | undefined;
  const refreshToken = cfg?.refreshToken as string | undefined;
  const tokenExpiry = Number(cfg?.tokenExpiry || 0);
  const isExpired = !tokenExpiry || Date.now() / 1000 > tokenExpiry - 60;

  if (accessToken && !isExpired) return accessToken;
  if (!refreshToken) throw new Error('OneDrive Refresh-Token fehlt in der Library-Konfiguration');

  const resp = await fetch(`${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')}/api/auth/onedrive/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ libraryId: lib.id, refreshToken })
  });
  if (!resp.ok) throw new Error(`OneDrive Token-Refresh fehlgeschlagen (${resp.status})`);
  const data = await resp.json();
  return data.accessToken as string;
}

async function onedriveUploadFile(accessToken: string, parentId: string, name: string, mime: string, buffer: Buffer): Promise<{ id: string }> {
  const base = parentId === 'root'
    ? `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(name)}:/content`
    : `https://graph.microsoft.com/v1.0/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`;
  let url = `${base}?@microsoft.graph.conflictBehavior=replace`;
  let res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  if (res.status === 409) {
    url = `${base}?@microsoft.graph.conflictBehavior=rename`;
    res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': mime }, body: buffer });
  }
  if (!res.ok) throw new Error(`OneDrive Upload fehlgeschlagen: ${res.status}`);
  const json: unknown = await res.json();
  return { id: (json as { id?: string }).id as string };
}

// onedriveEnsureFolder wurde entfernt, da nicht verwendet

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(_request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });

    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    if (job.userEmail !== userEmail) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional: Nur letzte N Logs zurückgeben via ?limit=...
    // Query-Params sind in App Router bei Route Handlern nicht direkt verfügbar ohne request.url zu parsen
    const url = new URL(_request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(1000, Number(limitParam))) : undefined;
    const buffered: Array<Record<string, unknown>> = [];
    const persisted = Array.isArray(job.logs) ? job.logs : [];
    const merged = [...persisted, ...buffered];
    const logs = limit ? merged.slice(-limit) : merged;

    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      worker: job.worker,
      operation: job.operation,
      processId: job.processId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      error: job.error,
      logs,
      result: job.result,
    });
  } catch {
    return NextResponse.json({ error: 'Unerwarteter Fehler' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const body = await request.json();

    // Token kann im Body, im X-Callback-Token-Header oder als Bearer kommen
    let callbackToken: string | undefined = body?.callback_token;
    if (!callbackToken) {
      const headerToken = request.headers.get('x-callback-token') || request.headers.get('X-Callback-Token');
      if (headerToken) callbackToken = headerToken;
    }
    if (!callbackToken) {
      const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) callbackToken = authHeader.substring('Bearer '.length);
    }
    if (!callbackToken) return NextResponse.json({ error: 'callback_token fehlt' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });

    const tokenHash = repo.hashSecret(callbackToken);
    if (tokenHash !== job.jobSecretHash) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Status auf running setzen und Prozess-ID loggen
    await repo.setStatus(jobId, 'running');
    if (body?.process?.id) await repo.setProcess(jobId, body.process.id);

    // Progress-Handling
    const progressValue = typeof body?.progress === 'number'
      ? body.progress
      : typeof body?.data?.progress === 'number'
        ? body.data.progress
        : typeof body?.percent === 'number'
          ? body.percent
          : typeof body?.data?.percent === 'number'
            ? body.data.percent
            : undefined;
    const phase = (typeof body?.phase === 'string' && body.phase) || (typeof body?.data?.phase === 'string' && body.data.phase) || undefined;
    const message = (typeof body?.message === 'string' && body.message) || (typeof body?.data?.message === 'string' && body.data.message) || undefined;

    const hasError = !!body?.error;
    const hasFinalPayload = !!(body?.data?.extracted_text || body?.data?.images_archive_url || body?.status === 'completed');

    if (!hasFinalPayload && !hasError && (progressValue !== undefined || phase || message)) {
      // Watchdog heartbeat
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: phase || 'progress', progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined, message });
      FileLogger.info('external-jobs', 'Progress-Event', {
        jobId,
        phase: phase || 'progress',
        progress: progressValue,
        message
      });
      // Push-Event für UI (SSE)
      getJobEventBus().emitUpdate(job.userEmail, {
        type: 'job_update',
        jobId,
        status: 'running',
        phase: phase || 'progress',
        progress: typeof progressValue === 'number' ? Math.max(0, Math.min(100, progressValue)) : undefined,
        message,
        updatedAt: new Date().toISOString(),
        jobType: job.job_type,
        fileName: job.correlation?.source?.name,
      });
      return NextResponse.json({ status: 'ok', jobId, kind: 'progress' });
    }

    if (hasError) {
      clearWatchdog(jobId);
      bufferLog(jobId, { phase: 'failed', details: body.error });
      // Bei Fehler: gepufferte Logs persistieren
      const buffered = drainBufferedLogs(jobId);
      for (const entry of buffered) {
        await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
      }
      await repo.setStatus(jobId, 'failed', { error: { code: 'worker_error', message: 'Externer Worker-Fehler', details: body.error } });
      getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: body?.error?.message, jobType: job.job_type, fileName: job.correlation?.source?.name });
      return NextResponse.json({ status: 'ok', jobId, kind: 'failed' });
    }

    // Finale Payload
    const extractedText: string | undefined = body?.data?.extracted_text;
    const imagesArchiveUrlFromWorker: string | undefined = body?.data?.images_archive_url;

    if (!extractedText && !imagesArchiveUrlFromWorker) {
      bumpWatchdog(jobId);
      bufferLog(jobId, { phase: 'noop' });
      return NextResponse.json({ status: 'ok', jobId, kind: 'noop' });
    }

    // Bibliothek laden (um Typ zu bestimmen)
    const libraryService = LibraryService.getInstance();
    const libraries = await libraryService.getUserLibraries(job.userEmail);
    const lib = libraries.find(l => l.id === job.libraryId);

    let savedItemId: string | undefined;
    const savedItems: string[] = [];

    if (lib && extractedText) {
      if (lib.type === 'local') {
        const provider = new FileSystemProvider(lib.path);
        const sourceId = job.correlation?.source?.itemId;
        const targetParentId = job.correlation?.source?.parentId || 'root';
        // Pfade nur bei Bedarf auflösen (derzeit nicht benötigt)
        // await provider.getPathById(sourceId ?? '').catch(() => undefined);
        // await provider.getPathById(targetParentId).catch(() => '/');
        // Pfade ermitteln (aktuell nur für Debugging/Logging nutzbar)
        // const sourceAbsPath = sourceRelPath und targetAbsPath aktuell ungenutzt

        // 1) Optionalen Template-Content laden (aus /templates oder per Chat-Setting 'transformerTemplate')
        let metadataFromTemplate: Record<string, unknown> | null = null;
        try {
          // Standard-Template-Inhalt (wird angelegt, falls kein Template gefunden wird)
          const defaultTemplateContent = `---
title: {{title|Vollständiger Titel des Dokuments (string)}}
shortTitle: {{shortTitle|Kurzer Titel ≤40 Zeichen, ohne abschließende Satzzeichen}}
slug: {{slug|ASCII, lowercase, kebab-case; Umlaute/Diakritika normalisieren; max 80; keine doppelten Bindestriche}}
summary: {{summary|1–2 Sätze, ≤120 Zeichen, neutral, nur aus Text extrahiert}}
teaser: {{teaser|2–3 Sätze, nicht identisch zu summary, prägnant, extraktiv}}
authors: {{authors|Array von Autoren, dedupliziert, Format "Nachname, Vorname" wenn möglich}}
tags: {{tags|Array relevanter Tags, normalisiert: lowercase, ASCII, kebab-case, dedupliziert}}
docType: {{docType|Eine aus: report, study, brochure, offer, contract, manual, law, guideline, other}}
year: {{year|Vierstelliges Jahr als number; wenn unbekannt: null}}
region: {{region|Region/Land aus Text; wenn unbekannt: ""}}
language: {{language|Dokumentsprache, z. B. "de" oder "en"}}
chapters: {{chapters|Array von Kapiteln mit title, level (1..3), order (int, 1-basiert), startEvidence (≤160), summary (≤1000, extraktiv), keywords (5–12)}}
toc: {{toc|Optionales Array von { title, page?, level? }, nur wenn explizit im Text erkennbar}}
---

# {{title|Dokumenttitel}}

## Zusammenfassung
{{summary|Kurzfassung für Management/Vertrieb}}

--- systemprompt
Rolle:
- Du bist ein penibler, rein EXTRAKTIVER Sachbearbeiter. Du liest Kleingedrucktes genau. Abweichungen von der Norm sind preisrelevant – knapp anmerken, aber nichts erfinden.

Strenge Regeln:
- Verwende ausschließlich Inhalte, die EXPLIZIT im gelieferten Text vorkommen. Keine Halluzinationen.
- Wenn eine geforderte Information im Text nicht sicher vorliegt: gib "" (leere Zeichenkette) bzw. null (für year) zurück.
- Antworte AUSSCHLIESSLICH mit einem gültigen JSON-Objekt. Keine Kommentare, kein Markdown, keine Code-Fences.

Format-/Normalisierungsregeln:
- shortTitle: ≤40 Zeichen, gut lesbar, ohne abschließende Satzzeichen.
- slug: ASCII, lowercase, kebab-case, max 80, Diakritika/Umlaute normalisieren (ä→ae, ö→oe, ü→ue, ß→ss), mehrere Leerzeichen/Bindestriche zu einem Bindestrich zusammenfassen.
- summary: 1–2 Sätze, ≤120 Zeichen, neutraler Ton, extraktiv.
- teaser: 2–3 Sätze, nicht identisch zu summary, extraktiv.
- authors: Array von Strings, dedupliziert. Format „Nachname, Vorname“ wenn eindeutig ableitbar.
- tags: Array von Strings; normalisieren (lowercase, ASCII, kebab-case), deduplizieren; nur, wenn klar aus Text ableitbar.
- docType: klassifiziere streng nach Textsignalen in { report, study, brochure, offer, contract, manual, law, guideline }; wenn unklar: "other".
- year: vierstelliges Jahr als number; nur übernehmen, wenn eindeutig (z. B. „Copyright 2024“, „Stand: 2023“).
- region: aus Text (z. B. Länder/Bundesländer/Regionen); sonst "".
- language: bestmögliche Schätzung (z. B. "de", "en") anhand des Textes.

Kapitelanalyse (extraktiv):
- Erkenne echte Kapitel-/Unterkapitelstarts (Level 1..3), nur wenn sie im Text vorkommen.
- Für JEDES Kapitel liefere: title, level (1..3), order (1-basiert), startEvidence (≤160, exakter Anfangstext), summary (≤1000, extraktiv bis zum nächsten Kapitelstart), keywords (5–12, kurz und textnah).
- toc (optional): Liste von { title, page?, level? } nur, wenn explizit als Inhaltsverzeichnis erkennbar; Titel müssen existierenden Kapiteln entsprechen.

Antwortschema (MUSS exakt ein JSON-Objekt sein, ohne Zusatztext):
{
  "title": string,
  "shortTitle": string,
  "slug": string,
  "summary": string,
  "teaser": string,
  "authors": string[],
  "tags": string[],
  "docType": "report" | "study" | "brochure" | "offer" | "contract" | "manual" | "law" | "guideline" | "other",
  "year": number | null,
  "region": string,
  "language": string,
  "chapters": [ { "title": string, "level": 1 | 2 | 3, "order": number, "startEvidence": string, "summary": string, "keywords": string[] } ],
  "toc": [ { "title": string, "page": number?, "level": number? } ] | []
}`;

          // Bevorzugter Template-Name aus Chat-Config (falls vorhanden)
          const preferredTemplate = ((lib.config?.chat as unknown as { transformerTemplate?: string })?.transformerTemplate || '').trim();
          // Templates-Ordner im Root suchen
          const rootItems = await provider.listItemsById('root');
          const templatesFolder = rootItems.find(it => it.type === 'folder' && typeof (it as { metadata?: { name?: string } }).metadata?.name === 'string' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'templates'));
          const ensureTemplatesFolderId = async (): Promise<string> => {
            if (templatesFolder) return templatesFolder.id;
            const created = await provider.createFolder('root', 'templates');
            bufferLog(jobId, { phase: 'templates_folder_created', message: 'Ordner /templates angelegt' });
            return created.id;
          };

          const templatesFolderId = await ensureTemplatesFolderId();

          if (templatesFolderId) {
            const tplItems = await provider.listItemsById(templatesFolderId);
            // Auswahllogik: bevorzugt preferredTemplate, sonst 'pdfanalyse.md', sonst erstes .md
            const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase()));
            const byPreferred = preferredTemplate ? pickByName(preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) : undefined;
            const byDefault = pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md');
            const anyMd = tplItems.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase().endsWith('.md')));
            let chosen = byPreferred || byDefault || anyMd;
            if (!chosen) {
              // Default-Template anlegen
              const tplFile = new File([new Blob([defaultTemplateContent], { type: 'text/markdown' })], 'pdfanalyse.md', { type: 'text/markdown' });
              const savedTpl = await provider.uploadFile(templatesFolderId, tplFile);
              bufferLog(jobId, { phase: 'template_created', message: 'Default-Template pdfanalyse.md angelegt' });
              // Neu laden
              const re = await provider.listItemsById(templatesFolderId);
              chosen = re.find(it => it.type === 'file' && ((it as { metadata: { name: string } }).metadata.name.toLowerCase() === 'pdfanalyse.md'));
            }
            if (chosen) {
              const bin = await provider.getBinary(chosen.id);
              const templateContent = await bin.blob.text();
              // 2) Secretary Transformer mit template_content aufrufen
              const secretaryUrlRaw = process.env.SECRETARY_SERVICE_URL || '';
              const transformerUrl = secretaryUrlRaw.endsWith('/') ? `${secretaryUrlRaw}transformer/template` : `${secretaryUrlRaw}/transformer/template`;
              const fd = new FormData();
              fd.append('text', extractedText);
              const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
              fd.append('target_language', lang);
              fd.append('template_content', templateContent);
              fd.append('use_cache', 'false');
              const headers: Record<string, string> = { 'Accept': 'application/json' };
              const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
              if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
              const resp = await fetch(transformerUrl, { method: 'POST', body: fd, headers });
              const data: unknown = await resp.json().catch(() => ({}));
              if (resp.ok && data && typeof data === 'object' && !Array.isArray(data)) {
                const d = (data as { data?: unknown }).data as { structured_data?: unknown; text?: unknown } | undefined;
                const normalized = normalizeStructuredData(d?.structured_data);
                if (normalized) {
                  metadataFromTemplate = normalized;
                } else {
                  metadataFromTemplate = null;
                }
                bufferLog(jobId, { phase: 'transform_meta', message: 'Metadaten via Template berechnet' });
              } else {
                bufferLog(jobId, { phase: 'transform_meta_failed', message: 'Transformer lieferte kein gültiges JSON' });
              }
            } else {
              bufferLog(jobId, { phase: 'template_missing', message: 'Kein Template gefunden' });
            }
          } else {
            bufferLog(jobId, { phase: 'templates_folder_missing', message: 'Ordner /templates nicht gefunden' });
          }
        } catch {
          bufferLog(jobId, { phase: 'transform_meta_error', message: 'Fehler bei Template-Transformation' });
        }

        // 3) Frontmatter-Metadaten bestimmen (Template bevorzugt, sonst Worker-Metadaten)
        const baseMeta = (body?.data?.metadata as Record<string, unknown>) || {};
        const finalMeta: Record<string, unknown> = metadataFromTemplate ? { ...metadataFromTemplate } : { ...baseMeta };

        // 4) Markdown mit Frontmatter erzeugen (Body = Originaltext)
        const markdown = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, finalMeta)
          : extractedText;

        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;

        const file = new File([new Blob([markdown], { type: 'text/markdown' })], uniqueName, { type: 'text/markdown' });
        const saved = await provider.uploadFile(targetParentId, file);
        bufferLog(jobId, { phase: 'stored_local', message: 'Shadow‑Twin gespeichert' });
        savedItemId = saved.id;

        // Lade ZIP-Archiv bei Bedarf vom Secretary-Service und extrahiere lokal
        if (imagesArchiveUrlFromWorker) {
          try {
            const baseRaw = process.env.SECRETARY_SERVICE_URL || '';
            const isAbsolute = /^https?:\/\//i.test(imagesArchiveUrlFromWorker);
            let archiveUrl = imagesArchiveUrlFromWorker;
            if (!isAbsolute) {
              try {
                archiveUrl = new URL(imagesArchiveUrlFromWorker, baseRaw).toString();
              } catch {
                const base = baseRaw.replace(/\/$/, '');
                const rel = imagesArchiveUrlFromWorker.startsWith('/') ? imagesArchiveUrlFromWorker : `/${imagesArchiveUrlFromWorker}`;
                archiveUrl = base.endsWith('/api') && rel.startsWith('/api/')
                  ? `${base}${rel.substring(4)}`
                  : `${base}${rel}`;
              }
            }
            const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
            const headers: Record<string, string> = {};
            if (apiKey) {
              headers['Authorization'] = `Bearer ${apiKey}`;
              headers['X-Service-Token'] = apiKey;
            }
            const resp = await fetch(archiveUrl, { method: 'GET', headers });
            if (!resp.ok) {
              bufferLog(jobId, { phase: 'images_download_failed', message: `Archiv-Download fehlgeschlagen: ${resp.status}` });
              // Markiere Job als fehlgeschlagen und beende
              clearWatchdog(jobId);
              const bufferedNow = drainBufferedLogs(jobId);
              for (const entry of bufferedNow) {
                await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
              }
              await repo.setStatus(jobId, 'failed', { error: { code: 'images_download_failed', message: 'Bild-Archiv konnte nicht geladen werden', details: { status: resp.status } } });
              getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Archiv-Download fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
              return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_download' });
            } else {
              const arrayBuf = await resp.arrayBuffer();
              const base64Zip = Buffer.from(arrayBuf).toString('base64');
              const originalItemForImages = {
                id: sourceId || 'unknown',
                parentId: targetParentId,
                type: 'file' as const,
                metadata: {
                  name: job.correlation.source?.name || 'source.pdf',
                  size: 0,
                  modifiedAt: new Date(),
                  mimeType: job.correlation.source?.mimeType || 'application/pdf',
                },
              };
              const textContents = (body?.data?.metadata?.text_contents as Array<{ page: number; content: string }> | undefined);
              const imageResult = await ImageExtractionService.saveZipArchive(
                base64Zip,
                'images.zip',
                originalItemForImages,
                provider,
                async (folderId: string) => provider.listItemsById(folderId),
                extractedText,
                lang,
                textContents
              );
              for (const it of imageResult.savedItems) savedItems.push(it.id);
              bufferLog(jobId, { phase: 'images_extracted', message: `Bilder gespeichert (${imageResult.savedItems.length})` });
            }
          } catch {
            bufferLog(jobId, { phase: 'images_extract_failed', message: 'ZIP-Extraktion fehlgeschlagen' });
            // Markiere Job als fehlgeschlagen und beende
            clearWatchdog(jobId);
            const bufferedNow = drainBufferedLogs(jobId);
            for (const entry of bufferedNow) {
              await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
            }
            await repo.setStatus(jobId, 'failed', { error: { code: 'images_extract_failed', message: 'ZIP-Archiv konnte nicht extrahiert werden' } });
            getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'failed', updatedAt: new Date().toISOString(), message: 'Bilder-Extraktion fehlgeschlagen', jobType: job.job_type, fileName: job.correlation?.source?.name });
            return NextResponse.json({ status: 'ok', jobId, kind: 'failed_images_extract' });
          }
        }
      } else if (lib && lib.type === 'onedrive') {
        const accessToken = await ensureOneDriveAccessToken(lib);
        const targetParentId = job.correlation?.source?.parentId || 'root';
        const baseName = (job.correlation.source?.name || 'output').replace(/\.[^/.]+$/, '');
        const lang = (job.correlation.options?.targetLanguage as string | undefined) || 'de';
        const uniqueName = `${baseName}.${lang}.md`;
        const md = typeof (TransformService as unknown as { createMarkdownWithFrontmatter?: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter === 'function'
          ? (TransformService as unknown as { createMarkdownWithFrontmatter: (c: string, m: Record<string, unknown>) => string }).createMarkdownWithFrontmatter(extractedText, (body?.data?.metadata as Record<string, unknown>) || {})
          : extractedText;
        const contentBuffer = Buffer.from(md, 'utf8');
        const saved = await onedriveUploadFile(accessToken, targetParentId, uniqueName, 'text/markdown', contentBuffer);
        savedItemId = saved.id;
        savedItems.push(saved.id);

        bufferLog(jobId, { phase: 'stored_cloud', message: 'Shadow‑Twin gespeichert' });

        // Bilder nicht mehr vom Webhook-ZIP extrahieren – Link wird bereitgestellt
      }
    }

    await repo.setStatus(jobId, 'completed');
    clearWatchdog(jobId);
    // gepufferte Logs persistieren
    const buffered = drainBufferedLogs(jobId);
    for (const entry of buffered) {
      await repo.appendLog(jobId, entry as unknown as Record<string, unknown>);
    }
    await repo.setResult(jobId, {
      extracted_text: extractedText,
      images_archive_url: imagesArchiveUrlFromWorker || undefined,
      metadata: body?.data?.metadata,
    }, { savedItemId, savedItems });

    // Finalen Logeintrag für den sichtbaren Verlauf hinzufügen
    await repo.appendLog(jobId, { phase: 'completed', message: 'Job abgeschlossen' });

    FileLogger.info('external-jobs', 'Job completed', { jobId, savedItemId, savedItemsCount: savedItems.length });
    getJobEventBus().emitUpdate(job.userEmail, { type: 'job_update', jobId, status: 'Job abgeschlossen', progress: 100, updatedAt: new Date().toISOString(), message: 'completed', jobType: job.job_type, fileName: job.correlation?.source?.name });
    return NextResponse.json({ status: 'ok', jobId, kind: 'final', savedItemId, savedItemsCount: savedItems.length });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}


