# Fehlerbehebung und BNPM Build starten
_Exported on 10/9/2025 at 14:59:19 GMT+2 from Cursor (1.7.38)_

---

**User**

Linterfehler beheben und diesen BNPM Build selbstständig starten und auf neue Fehler prüfen, solange bis der Build durchläuft.

---

**Cursor**

Ich starte mit einer kurzen Bestandsaufnahme und suche die fehlerhafte Stelle im Code, um den Typfehler sauber zu beheben. Danach führe ich den Build aus und iteriere, bis er durchläuft.

Ich suche die fehlerhafte Stelle im Retry-Route-Handler und die zugehörigen Typen, um den Zugriff auf `bin.name` korrekt zu ersetzen. Anschließend passe ich den Code minimal an.

Ich suche die Typdefinition von `getServerProvider` und der Rückgabe von `getBinary`, um den korrekten Feldnamen zu verwenden und den minimalen Fix vorzunehmen. Danach passe ich die fehlerhafte Zeile an.

Ich passe die fehlerhafte Zeile in der Retry-Route an (entferne den Zugriff auf `bin.name` und setze einen sicheren Fallback-Dateinamen). Danach starte ich den Build und prüfe auf weitere Fehler.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Ich entferne die ungenutzten Importe, die den Build stoppen, und starte anschließend erneut den Build.

Ich entferne ungenutzte Importe in drei Dateien, um die ESLint-Fehler zu beheben, und starte anschließend den Build erneut.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { ExternalJobsRepository } from '@/lib/external-jobs-repository';
import crypto from 'crypto';
import { getJobEventBus } from '@/lib/events/job-event-bus';
import { startWatchdog, clearWatchdog } from '@/lib/external-jobs-watchdog';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    const { jobId } = await params;
    if (!jobId) return NextResponse.json({ error: 'jobId erforderlich' }, { status: 400 });

    const repo = new ExternalJobsRepository();
    const job = await repo.get(jobId);
    if (!job) return NextResponse.json({ error: 'Job nicht gefunden' }, { status: 404 });
    if (job.userEmail !== userEmail) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (job.status !== 'failed' && job.status !== 'queued') {
      return NextResponse.json({ error: 'Nur failed oder queued Jobs können neu gestartet werden' }, { status: 400 });
    }

    // In-Place Requeue: Bestehenden Job zurücksetzen und mit gleicher jobId erneut an Secretary senden
    const libraryId = job.libraryId;
    const source = job.correlation?.source;
    if (!source?.itemId || !source?.parentId) {
      return NextResponse.json({ error: 'Quelle für Retry unvollständig' }, { status: 400 });
    }

    const { getServerProvider } = await import('@/lib/storage/server-provider');
    const provider = await getServerProvider(userEmail, libraryId);
    const bin = await provider.getBinary(source.itemId);
    const filename = source.name || 'document.pdf';
    const file = new File([bin.blob], filename, { type: source.mimeType || bin.mimeType || 'application/pdf' });

    // Secretary-FormData aufbauen (wie in process-pdf für den Worker-Call)
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);
    const opts = (job.correlation?.options || {}) as Record<string, unknown>;
    serviceFormData.append('target_language', typeof opts['targetLanguage'] === 'string' ? String(opts['targetLanguage']) : 'de');
    serviceFormData.append('extraction_method', typeof opts['extractionMethod'] === 'string' ? String(opts['extractionMethod']) : 'native');
    serviceFormData.append('useCache', String(typeof opts['useCache'] === 'boolean' ? opts['useCache'] : true));
    serviceFormData.append('includeImages', String(typeof opts['includeImages'] === 'boolean' ? opts['includeImages'] : false));

    // Callback-URL und -Token (neues Secret generieren)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    if (!appUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL fehlt' }, { status: 500 });
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/external/jobs/${jobId}`;
    const newSecret = crypto.randomBytes(24).toString('base64url');
    const newHash = repo.hashSecret(newSecret);
    // Job zurücksetzen
    await repo.initializeSteps(jobId, [
      { name: 'extract_pdf', status: 'pending' },
      { name: 'transform_template', status: 'pending' },
      { name: 'store_shadow_twin', status: 'pending' },
      { name: 'ingest_rag', status: 'pending' },
    ], job.parameters);
    await repo.setStatus(jobId, 'queued', { jobSecretHash: newHash });
    await repo.appendLog(jobId, { phase: 'request_sent_requeue', callbackUrl });
    // Live-Event + Watchdog
    getJobEventBus().emitUpdate(userEmail, { type: 'job_update', jobId, status: 'queued', progress: 0, updatedAt: new Date().toISOString(), message: 'requeued', jobType: job.job_type, fileName: job.correlation?.source?.name, sourceItemId: job.correlation?.source?.itemId });
    startWatchdog({ jobId, userEmail, jobType: job.job_type, fileName: job.correlation?.source?.name }, 600_000);

    serviceFormData.append('callback_url', callbackUrl);
    serviceFormData.append('callback_token', newSecret);

    // Secretary aufrufen
    const baseUrl = process.env.SECRETARY_SERVICE_URL || '';
    const normalizedUrl = baseUrl.endsWith('/') ? `${baseUrl}pdf/process` : `${baseUrl}/pdf/process`;
    let response: Response;
    try {
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      const apiKey = process.env.SECRETARY_SERVICE_API_KEY;
      if (apiKey) { headers['Authorization'] = `Bearer ${apiKey}`; headers['X-Service-Token'] = apiKey; }
      response = await fetch(normalizedUrl, { method: 'POST', body: serviceFormData, headers });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'worker_unavailable';
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_unavailable', message } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: message }, { status: 503 });
    }

    await repo.appendLog(jobId, { phase: 'request_ack', status: response.status, statusText: response.statusText });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      await repo.updateStep(jobId, 'extract_pdf', { status: 'failed', endedAt: new Date(), details: { reason: 'worker_error', status: response.status, statusText: response.statusText } });
      await repo.setStatus(jobId, 'failed');
      clearWatchdog(jobId);
      return NextResponse.json({ error: data?.error || 'Secretary Fehler' }, { status: response.status });
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json({ ok: true, jobId, worker: 'secretary', data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

```typescriptreact
"use client";

import { useAtom } from 'jotai'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { combinedChatDialogOpenAtom } from '@/atoms/combined-chat-atom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useAtomValue } from 'jotai'
import { activeLibraryIdAtom } from '@/atoms/library-atom'
import { StorageItem, StorageProvider } from '@/lib/storage/types'
import { toast } from 'sonner'

interface CombinedChatDialogProps {
  provider: StorageProvider | null
  items: Array<StorageItem>
  selectedTemplate: string
  selectedLanguage: string
  defaultFileName: string
  systemPrompt?: string
  templateBody?: string
}

export function CombinedChatDialog({ provider, items, selectedTemplate, selectedLanguage, defaultFileName, systemPrompt = 'Du bist ein hilfreicher, faktenbasierter Assistent. Nutze ausschließlich den bereitgestellten Kontext.', templateBody = '' }: CombinedChatDialogProps) {
  const [open, setOpen] = useAtom(combinedChatDialogOpenAtom)
  const libraryId = useAtomValue(activeLibraryIdAtom)
  const [instructions, setInstructions] = useState<string>(templateBody)
  const [answer, setAnswer] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [fileName, setFileName] = useState<string>(defaultFileName)
  const [templateContent, setTemplateContent] = useState<string>(templateBody)
  const [templateVars, setTemplateVars] = useState<Array<{ key: string; question: string }>>([])
  const [chatInput, setChatInput] = useState<string>('')
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user'|'assistant'; content: string }>>([])

  const disabled = useMemo(() => loading || !provider || items.length === 0 || !libraryId, [loading, provider, items.length, libraryId])

  // Template laden (aus /templates/<selectedTemplate>.md), wenn kein templateBody gesetzt ist
  useEffect(() => {
    let cancelled = false
    async function loadTemplate() {
      if (!provider || !open) return
      try {
        if (templateBody) {
          if (!cancelled) setTemplateContent(templateBody)
        } else {
          const roots = await provider.listItemsById('root')
          const templatesFolder = roots.find(it => it.type === 'folder' && it.metadata?.name === 'templates')
          if (!templatesFolder) return
          const items = await provider.listItemsById(templatesFolder.id)
          const tpl = items.find(it => it.type === 'file' && it.metadata?.name?.toLowerCase() === `${selectedTemplate.toLowerCase()}.md`)
          if (!tpl) return
          const { blob } = await provider.getBinary(tpl.id)
          const text = await blob.text()
          if (!cancelled) { setTemplateContent(text); setInstructions(text) }
        }
      } catch { /* ignore */ }
    }
    loadTemplate()
    return () => { cancelled = true }
  }, [provider, open, selectedTemplate, templateBody])

  // Variablen aus Template extrahieren
  useEffect(() => {
    const vars: Array<{ key: string; question: string }> = []
    const re = /\{\{([^}|]+)\|([^}]+)\}\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(templateContent)) !== null) {
      const key = m[1].trim()
      const question = m[2].trim()
      if (key) vars.push({ key, question })
    }
    setTemplateVars(vars)
  }, [templateContent])

  const loadContextText = useCallback(async (): Promise<string> => {
    if (!provider) return ''
    const parts: string[] = []
    for (const it of items) {
      try {
        const { blob } = await provider.getBinary(it.id)
        const text = await blob.text()
        parts.push(`# ${it.metadata.name}\n\n${text}\n\n---\n`)
      } catch {
        // ignore single file errors
      }
    }
    return parts.join('\n')
  }, [provider, items])

  const handleTemplateChatSend = useCallback(async () => {
    const msg = chatInput.trim()
    if (!msg) return
    try {
      setLoading(true)
      setChatHistory(prev => [...prev, { role: 'user', content: msg }])
      setChatInput('')
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/adhoc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, instructions: msg, contextText: templateContent, answerLength: 'mittel' })
      })
      const data = await res.json().catch(() => ({})) as { status?: string; answer?: string; error?: string }
      if (!res.ok) throw new Error(data?.error || 'Chat fehlgeschlagen')
      const ai = (data?.answer || '').trim()
      setChatHistory(prev => [...prev, { role: 'assistant', content: ai }])
    } catch (e) {
      toast.error('Fehler', { description: e instanceof Error ? e.message : 'Unbekannter Fehler' })
    } finally {
      setLoading(false)
    }
  }, [libraryId, systemPrompt, templateContent, chatInput])

  const handlePreview = useCallback(async () => {
    try {
      setLoading(true)
      setAnswer('')
      const contextText = await loadContextText()
      const res = await fetch(`/api/chat/${encodeURIComponent(libraryId)}/adhoc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt, instructions, contextText, answerLength: 'mittel' })
      })
      const data = await res.json().catch(() => ({})) as { status?: string; answer?: string; error?: string }
      if (!res.ok) throw new Error(data?.error || 'Vorschau fehlgeschlagen')
      setAnswer(data?.answer || '')
    } catch (e) {
      toast.error('Fehler', { description: e instanceof Error ? e.message : 'Unbekannter Fehler' })
    } finally {
      setLoading(false)
    }
  }, [libraryId, systemPrompt, instructions, loadContextText])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Prompt‑Design (kombinierter Dialog)</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Linke Spalte: Template‑Struktur + Chat mit Template */}
          <div className="space-y-3">
            <div>
              <Label>Template</Label>
              <div className="text-sm text-muted-foreground mb-2">{selectedTemplate} · {selectedLanguage}</div>
              <div className="border rounded p-2 max-h-[180px] overflow-auto text-sm">
                {templateVars.length === 0 ? (
                  <div className="text-muted-foreground text-xs">Keine Variablen gefunden.</div>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {templateVars.map(v => (
                      <li key={v.key}><span className="font-mono">{v.key}</span>: {v.question}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div>
              <Label>Template‑Chat</Label>
              <div className="border rounded p-2 h-[180px] overflow-auto text-sm mb-2">
                {chatHistory.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Stelle eine Frage zum Template, z. B. „Wie präzisiere ich die Zusammenfassung?“. Antwort erscheint hier.</div>
                ) : (
                  <div className="space-y-2">
                    {chatHistory.map((m, i) => (
                      <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                        <span className={"inline-block rounded px-2 py-1 " + (m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{m.content}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Frage an das Template…" onKeyDown={(e) => { if (e.key === 'Enter') handleTemplateChatSend() }} />
                <Button onClick={handleTemplateChatSend} disabled={disabled || !chatInput.trim()}>{loading ? '…' : 'Senden'}</Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={handlePreview} disabled={disabled}>{loading ? 'Lade…' : 'Template anwenden (Vorschau)'}</Button>
            </div>
          </div>

          {/* Rechte Spalte: Vorschau + Dateiname + Aktionen */}
          <div className="space-y-3">
            <div>
              <Label>Vorschau</Label>
              <div className="border rounded p-3 h-[300px] overflow-auto text-sm whitespace-pre-wrap">{answer}</div>
            </div>
            <div>
              <Label htmlFor="fn">Dateiname</Label>
              <Input id="fn" value={fileName} onChange={(e) => setFileName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Schließen</Button>
              <Button disabled>Dokument generieren (später)</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}



```

```typescriptreact
"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StructuredTemplateEditor } from "@/components/templates/structured-template-editor"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Plus, Trash2, Eye, Play, FolderOpen, Info } from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import { activeLibraryAtom, libraryStatusAtom } from "@/atoms/library-atom"
import { 
  templatesAtom, 
  selectedTemplateNameAtom, 
  selectedTemplateAtom,
  templatesFolderIdAtom,
  templateLoadingAtom,
  templateErrorAtom,
  type Template
} from "@/atoms/template-atom"
import { useStorage } from "@/contexts/storage-context"
import { templateContextDocsAtom } from '@/atoms/template-context-atom'
import { Checkbox } from "@/components/ui/checkbox"
import { MarkdownPreview } from "@/components/library/markdown-preview"

// Schema für Template-Daten
const templateSchema = z.object({
  name: z.string().min(1, "Prompt-Name ist erforderlich"),
  yamlFrontmatter: z.string(),
  markdownBody: z.string(),
  systemPrompt: z.string(),
})

type TemplateFormValues = z.infer<typeof templateSchema>

export function TemplateManagement() {
  const [previewMode, setPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([])
  const [selectedContextMarkdown, setSelectedContextMarkdown] = useState<string>("")
  const { toast } = useToast()

  // Atoms
  const [templates, setTemplates] = useAtom(templatesAtom)
  const [selectedTemplateName, setSelectedTemplateName] = useAtom(selectedTemplateNameAtom)
  const [selectedTemplate] = useAtom(selectedTemplateAtom)
  const [templatesFolderId, setTemplatesFolderId] = useAtom(templatesFolderIdAtom)
  const [isLoading, setIsLoading] = useAtom(templateLoadingAtom)
  const [error, setError] = useAtom(templateErrorAtom)

  // Library und Storage
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryStatus = useAtomValue(libraryStatusAtom)
  const { 
    provider: providerInstance, 
    listItems
  } = useStorage()
  const contextDocs = useAtomValue(templateContextDocsAtom)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      yamlFrontmatter: `---
title: {{title|Titel des Dokuments}}
tags: {{tags|Relevante Tags}}
date: {{date|Datum im Format yyyy-mm-dd}}
---`,
      markdownBody: `# {{title}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung des Inhalts}}

## Details
{{details|Detaillierte Beschreibung}}`,
      systemPrompt: `You are a specialized assistant that processes and structures information clearly and concisely.

IMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
    },
  })

  // Helper zum Erzeugen von Default-Werten
  function getDefaultTemplateValues(name: string): TemplateFormValues {
    return {
      name,
      yamlFrontmatter: `---\n` +
        `title: {{title|Titel des Dokuments}}\n` +
        `tags: {{tags|Relevante Tags}}\n` +
        `date: {{date|Datum im Format yyyy-mm-dd}}\n` +
        `---`,
      markdownBody: `# {{title}}\n\n## Zusammenfassung\n{{summary|Kurze Zusammenfassung des Inhalts}}\n\n## Details\n{{details|Detaillierte Beschreibung}}`,
      systemPrompt: `You are a specialized assistant that processes and structures information clearly and concisely.\n\nIMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
    }
  }

  // Template-Daten laden wenn sich die Auswahl ändert
  useEffect(() => {
    if (selectedTemplate) {
      form.reset({
        name: selectedTemplate.name,
        yamlFrontmatter: selectedTemplate.yamlFrontmatter,
        markdownBody: selectedTemplate.markdownBody,
        systemPrompt: selectedTemplate.systemPrompt,
      })
    }
  }, [selectedTemplate, form])

  // Ordner-Erstellung/Suche memoisiert, damit als Dep verwendbar
  const ensureTemplatesFolder = useCallback(async (): Promise<string> => {
    if (!providerInstance || !activeLibrary) {
      throw new Error("Keine aktive Bibliothek oder Provider verfügbar");
    }

    try {
      console.log('[TemplateManagement] Suche nach Templates-Ordner...');
      const rootItems = await listItems('root');
      const templatesFolder = rootItems.find(item => 
        item.type === 'folder' && item.metadata.name === 'templates'
      );
      if (templatesFolder) {
        console.log('[TemplateManagement] Templates-Ordner gefunden:', templatesFolder.id);
        return templatesFolder.id;
      }
      console.log('[TemplateManagement] Templates-Ordner nicht gefunden, erstelle neuen...');
      const newFolder = await providerInstance.createFolder('root', 'templates');
      console.log('[TemplateManagement] Neuer Templates-Ordner erstellt:', newFolder.id);
      return newFolder.id;
    } catch (error) {
      console.error('Fehler beim Erstellen des Templates-Ordners:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });
      let errorMessage = 'Fehler beim Erstellen des Templates-Ordners';
      if (error instanceof Error) {
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um den Templates-Ordner zu erstellen.';
        } else if (error.message.includes('Keine Berechtigung')) {
          errorMessage = 'Keine Berechtigung zum Erstellen von Ordnern in der Bibliothek.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden.';
        } else {
          errorMessage = `Fehler beim Erstellen des Templates-Ordners: ${error.message}`;
        }
      }
      throw new Error(errorMessage);
    }
  }, [providerInstance, activeLibrary, listItems]);

  // Templates laden mit der gleichen Logik wie Library-Komponente
  const loadTemplates = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready' || !activeLibrary) {
      console.log('[TemplateManagement] loadTemplates übersprungen:', {
        hasProvider: !!providerInstance,
        libraryStatus,
        hasActiveLibrary: !!activeLibrary
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[TemplateManagement] Starte Prompt-Loading:', {
        libraryId: activeLibrary.id,
        libraryPath: activeLibrary.path,
        providerName: providerInstance.name
      });

      // 1. Templates-Ordner finden oder erstellen
      const folderId = await ensureTemplatesFolder();
      setTemplatesFolderId(folderId);

      console.log('[TemplateManagement] Templates-Ordner gefunden/erstellt:', folderId);

      // 2. Alle Template-Dateien im Ordner auflisten
      const items = await listItems(folderId);
      const templateFiles = items.filter(item => 
        item.type === 'file' && 
        item.metadata.name.endsWith('.md')
      );

      console.log('[TemplateManagement] Prompt-Dateien gefunden:', templateFiles.length);

      // 3. Template-Inhalte laden
      const templatePromises = templateFiles.map(async (file) => {
        try {
          const { blob } = await providerInstance.getBinary(file.id);
          const content = await blob.text();
          const template = parseTemplateContent(content, file.metadata.name.replace('.md', ''));
          
          return {
            ...template,
            fileId: file.id,
            lastModified: typeof file.metadata.modifiedAt === 'string' 
              ? file.metadata.modifiedAt 
              : file.metadata.modifiedAt instanceof Date 
                ? file.metadata.modifiedAt.toISOString()
                : new Date().toISOString()
          } as Template;
        } catch (error) {
          console.error(`Fehler beim Parsen von ${file.metadata.name}:`, error);
          return null;
        }
      });

      const loadedTemplates = await Promise.all(templatePromises);
      const validTemplates = loadedTemplates.filter((t): t is Template => t !== null);
      
      setTemplates(validTemplates);
      
      console.log('[TemplateManagement] Prompts erfolgreich geladen:', validTemplates.length);
      
      if (validTemplates.length === 0) {
        toast({
          title: "Keine Prompts gefunden",
          description: "Erstellen Sie Ihren ersten Prompt im Verzeichnis '/templates'.",
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Prompts:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });

      let errorMessage = 'Unbekannter Fehler beim Laden der Prompts';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Spezifische Fehlermeldungen für häufige Probleme
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um Prompts zu laden.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
        } else if (error.message.includes('Server-Fehler')) {
          errorMessage = 'Server-Fehler beim Laden der Prompts. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
        } else if (error.message.includes('Keine aktive Bibliothek')) {
          errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
        }
      }
      
      setError(errorMessage);
      toast({
        title: "Fehler beim Laden der Prompts",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [providerInstance, libraryStatus, activeLibrary, listItems, setTemplates, setTemplatesFolderId, setIsLoading, setError, toast, ensureTemplatesFolder]);

  // Effect für Template Loading (wie Library-Komponente)
  useEffect(() => {
    const isReady = providerInstance && libraryStatus === 'ready' && activeLibrary
    
    if (!isReady) {
      return
    }

    // Templates laden wenn noch nicht geladen
    if (!templatesFolderId) {
      loadTemplates()
    }
  }, [providerInstance, libraryStatus, activeLibrary, templatesFolderId, loadTemplates])

  // Reset wenn sich die Library ändert
  useEffect(() => {
    setSelectedTemplateName(null)
    setTemplatesFolderId(null)
    setTemplates([])
    setError(null)
  }, [libraryStatus, setSelectedTemplateName, setTemplatesFolderId, setTemplates, setError])

  useEffect(() => {
    async function loadSelectedContext() {
      if (!providerInstance || !Array.isArray(selectedContextIds) || selectedContextIds.length === 0) {
        setSelectedContextMarkdown("")
        return
      }
      try {
        const parts: string[] = []
        for (const id of selectedContextIds) {
          const { blob } = await providerInstance.getBinary(id)
          const text = await blob.text()
          parts.push(text)
        }
        setSelectedContextMarkdown(parts.join("\n\n---\n\n"))
      } catch (e) {
        console.error('Fehler beim Laden des Kontextes', e)
        setSelectedContextMarkdown("")
      }
    }
    void loadSelectedContext()
  }, [providerInstance, selectedContextIds])

  function parseTemplateContent(content: string, fileName: string): Template {
    // Template in drei Bereiche aufteilen
    const parts = content.split('--- systemprompt')
    
    let yamlFrontmatter = ""
    let markdownBody = ""
    let systemPrompt = ""
    
    if (parts.length >= 2) {
      const mainContent = parts[0].trim()
      systemPrompt = parts[1].trim()
      
      // YAML Frontmatter extrahieren
      const yamlMatch = mainContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        // Kein YAML Frontmatter gefunden
        markdownBody = mainContent
      }
    } else {
      // Kein Systemprompt gefunden
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        markdownBody = content
      }
    }

    return {
      name: fileName,
      yamlFrontmatter,
      markdownBody,
      systemPrompt,
    }
  }

  function generateTemplateContent(values: TemplateFormValues): string {
    let content = ""
    
    // YAML Frontmatter hinzufügen
    if (values.yamlFrontmatter.trim()) {
      content += values.yamlFrontmatter + "\n\n"
    }
    
    // Markdown Body hinzufügen
    content += values.markdownBody
    
    // System Prompt hinzufügen
    if (values.systemPrompt.trim()) {
      content += "\n\n--- systemprompt\n" + values.systemPrompt
    }
    
    return content
  }

  async function onSubmit(data: TemplateFormValues) {
    if (!activeLibrary || !templatesFolderId || !providerInstance) {
      toast({
        title: "Fehler",
        description: "Keine aktive Bibliothek oder Templates-Ordner nicht gefunden.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const templateContent = generateTemplateContent(data)
      const fileName = `${data.name}.md`
      
      // Datei als Blob erstellen
      const blob = new Blob([templateContent], { type: 'text/markdown' })
      const file = new File([blob], fileName, { type: 'text/markdown' })
      
      // Datei hochladen
      await providerInstance.uploadFile(templatesFolderId, file)
      
      // Templates neu laden
      await loadTemplates()
      
      // Auswahl auf das neue Template setzen
      setSelectedTemplateName(data.name)
      
      toast({
        title: "Template gespeichert",
        description: `Template "${data.name}" wurde erfolgreich im Verzeichnis "/templates" gespeichert.`,
      })
    } catch (error) {
      console.error('Fehler beim Speichern des Templates:', error)
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function renameCurrentTemplate() {
    const current = selectedTemplateName ? templates.find(t => t.name === selectedTemplateName) : null
    if (!current || !current.fileId || !providerInstance) return
    const newName = (window.prompt('Neuen Namen eingeben:', current.name) || '').trim()
    if (!newName || newName === current.name) return
    if (/[^a-zA-Z0-9._\- ]/.test(newName)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === newName.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    try {
      await providerInstance.renameItem(current.fileId, `${newName}.md`)
      await loadTemplates()
      setSelectedTemplateName(newName)
      form.setValue('name', newName, { shouldDirty: false })
      toast({ title: 'Umbenannt', description: `${current.name} → ${newName}` })
    } catch (e) {
      toast({ title: 'Fehler beim Umbenennen', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
    }
  }

  async function deleteTemplate(templateName: string) {
    if (!activeLibrary || !providerInstance) return

    try {
      const template = templates.find(t => t.name === templateName)
      if (!template?.fileId) {
        throw new Error("Template-Datei nicht gefunden")
      }

      // Datei löschen
      await providerInstance.deleteItem(template.fileId)

      // Templates neu laden
      await loadTemplates()
      
      if (selectedTemplateName === templateName) {
        setSelectedTemplateName(null)
        form.reset()
      }
      
      toast({
        title: "Template gelöscht",
        description: `Template "${templateName}" wurde erfolgreich gelöscht.`,
      })
    } catch (error) {
      console.error('Fehler beim Löschen des Templates:', error)
      toast({
        title: "Fehler beim Löschen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    }
  }

  async function createNewTemplate() {
    const name = (window.prompt('Neuen Template‑Namen eingeben:') || '').trim()
    if (!name) return
    if (/[^a-zA-Z0-9._\- ]/.test(name)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === name.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    if (!providerInstance) { toast({ title: 'Kein Provider' , variant: 'destructive' }); return }
    try {
      const folderId = await ensureTemplatesFolder()
      const values = getDefaultTemplateValues(name)
      const content = (values.yamlFrontmatter ? values.yamlFrontmatter + '\n\n' : '') + values.markdownBody + '\n\n--- systemprompt\n' + values.systemPrompt
      const file = new File([new Blob([content], { type: 'text/markdown' })], `${name}.md`, { type: 'text/markdown' })
      await providerInstance.uploadFile(folderId, file)
      await loadTemplates()
      setSelectedTemplateName(name)
      form.reset(values)
      toast({ title: 'Template angelegt', description: `"${name}" wurde erstellt.` })
    } catch (e) {
      toast({ title: 'Fehler beim Anlegen', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
    }
  }

  function generatePreview(): string {
    const values = form.getValues()
    return generateTemplateContent(values)
  }

  async function testTemplate() {
    if (!activeLibrary) return

    setIsTesting(true)
    setTestResult(null)

    const values = form.getValues()
    const templateContent = generateTemplateContent(values)
    const testText = selectedContextMarkdown || ""

    try {
      const response = await fetch('/api/secretary/process-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Library-Id': activeLibrary.id,
        },
        body: new URLSearchParams({
          text: testText,
          template_content: templateContent,
          source_language: 'de',
          target_language: 'de',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      const formattedResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      setTestResult(formattedResult)

      toast({
        title: "Prompt-Test erfolgreich",
        description: "Der Prompt wurde erfolgreich mit dem gewählten Kontext verarbeitet.",
      })

      console.log('Prompt-Test Ergebnis:', result)
    } catch (error) {
      console.error('Fehler beim Prompt-Test:', error)
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler"
      setTestResult(`Fehler: ${errorMessage}`)
      toast({
        title: "Prompt-Test fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    )
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    )
  }

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        <p>Fehler beim Laden der Prompts:</p>
        <p className="text-sm">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={loadTemplates}
        >
          Erneut versuchen
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Kompakte Toolbar oben */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplateName || ''} onValueChange={(v) => { setSelectedTemplateName(v); form.setValue('name', v, { shouldDirty: false }) }} disabled={isLoading}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Prompt auswählen..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Info className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /><span>Ort: /templates in „{activeLibrary.label}“</span></div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button type="button" variant="outline" size="sm" onClick={createNewTemplate} disabled={isLoading}>Neu</Button>
        <Button type="button" variant="outline" size="sm" onClick={renameCurrentTemplate} disabled={!selectedTemplateName}>Umbenennen</Button>
        {selectedTemplateName && (
          <Button type="button" variant="destructive" size="sm" onClick={() => deleteTemplate(selectedTemplateName!)}>Löschen</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prompt Design</CardTitle>
            <CardDescription>
              Drei Bereiche: Aufgabe (was), Rollenanweisung (wie), Metadaten (Begleitinfos).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Template-Name Feld entfernt (oben verwaltet) */}

              {previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Prompt-Vorschau</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMode(false)}
                    >
                      Bearbeiten
                    </Button>
                  </div>
                  <div className="border rounded-md p-4 bg-muted/50">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {generatePreview()}
                    </pre>
                  </div>
                </div>
              ) : (
                <StructuredTemplateEditor
                  markdownBody={form.watch('markdownBody')}
                  yamlFrontmatter={form.watch('yamlFrontmatter')}
                  systemPrompt={form.watch('systemPrompt')}
                  onChange={({ markdownBody, yamlFrontmatter, systemPrompt }) => {
                    form.setValue('markdownBody', markdownBody, { shouldDirty: true })
                    form.setValue('yamlFrontmatter', yamlFrontmatter, { shouldDirty: true })
                    form.setValue('systemPrompt', systemPrompt, { shouldDirty: true })
                  }}
                />
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMode ? "Bearbeiten" : "Vorschau"}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isDirty}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prompt testen</CardTitle>
            <CardDescription>
              Test mit Beispieltext. Nutzt Rollenanweisung, Aufgabe und Metadaten des Prompts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kontext-Texte</Label>
                <div className="border rounded p-2 max-h-40 overflow-auto text-sm">
                  {Array.isArray(contextDocs) && contextDocs.length > 0 ? (
                    contextDocs.map(d => {
                      const checked = selectedContextIds.includes(d.id)
                      return (
                        <label key={d.id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const isOn = v === true
                              setSelectedContextIds(prev => isOn ? [...prev, d.id] : prev.filter(x => x !== d.id))
                            }}
                          />
                          <span className="truncate">{d.name}</span>
                        </label>
                      )
                    })
                  ) : (
                    <div className="text-muted-foreground text-sm">Keine Kontext-Texte verfügbar</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gewählter Kontext (Lesemodus)</Label>
                <div className="border rounded-md">
                  <MarkdownPreview content={selectedContextMarkdown} className="max-h-64 overflow-auto" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prompt‑Vorschau (Aufgabe als Markdown)</Label>
                <div className="border rounded-md">
                  <MarkdownPreview content={form.watch('markdownBody') || ''} className="max-h-64 overflow-auto" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testTemplate}
                  disabled={!selectedTemplateName || isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Teste...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Prompt testen
                    </>
                  )}
                </Button>
              </div>
              
              {testResult && (
                <div className="space-y-2">
                  <Label>Ergebnis (Markdown)</Label>
                  <div className="border rounded-md">
                    <MarkdownPreview content={testResult} className="max-h-80 overflow-auto" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
```

Ich entferne die ungenutzten `Plus` und `Trash2` Importe in `src/components/templates/template-management.tsx` und starte danach erneut den Build.

```typescriptreact
"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { StructuredTemplateEditor } from "@/components/templates/structured-template-editor"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, Eye, Play, FolderOpen, Info } from "lucide-react"
import { useAtom, useAtomValue } from "jotai"
import { activeLibraryAtom, libraryStatusAtom } from "@/atoms/library-atom"
import { 
  templatesAtom, 
  selectedTemplateNameAtom, 
  selectedTemplateAtom,
  templatesFolderIdAtom,
  templateLoadingAtom,
  templateErrorAtom,
  type Template
} from "@/atoms/template-atom"
import { useStorage } from "@/contexts/storage-context"
import { templateContextDocsAtom } from '@/atoms/template-context-atom'
import { Checkbox } from "@/components/ui/checkbox"
import { MarkdownPreview } from "@/components/library/markdown-preview"

// Schema für Template-Daten
const templateSchema = z.object({
  name: z.string().min(1, "Prompt-Name ist erforderlich"),
  yamlFrontmatter: z.string(),
  markdownBody: z.string(),
  systemPrompt: z.string(),
})

type TemplateFormValues = z.infer<typeof templateSchema>

export function TemplateManagement() {
  const [previewMode, setPreviewMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([])
  const [selectedContextMarkdown, setSelectedContextMarkdown] = useState<string>("")
  const { toast } = useToast()

  // Atoms
  const [templates, setTemplates] = useAtom(templatesAtom)
  const [selectedTemplateName, setSelectedTemplateName] = useAtom(selectedTemplateNameAtom)
  const [selectedTemplate] = useAtom(selectedTemplateAtom)
  const [templatesFolderId, setTemplatesFolderId] = useAtom(templatesFolderIdAtom)
  const [isLoading, setIsLoading] = useAtom(templateLoadingAtom)
  const [error, setError] = useAtom(templateErrorAtom)

  // Library und Storage
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const libraryStatus = useAtomValue(libraryStatusAtom)
  const { 
    provider: providerInstance, 
    listItems
  } = useStorage()
  const contextDocs = useAtomValue(templateContextDocsAtom)

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: "",
      yamlFrontmatter: `---
title: {{title|Titel des Dokuments}}
tags: {{tags|Relevante Tags}}
date: {{date|Datum im Format yyyy-mm-dd}}
---`,
      markdownBody: `# {{title}}

## Zusammenfassung
{{summary|Kurze Zusammenfassung des Inhalts}}

## Details
{{details|Detaillierte Beschreibung}}`,
      systemPrompt: `You are a specialized assistant that processes and structures information clearly and concisely.

IMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
    },
  })

  // Helper zum Erzeugen von Default-Werten
  function getDefaultTemplateValues(name: string): TemplateFormValues {
    return {
      name,
      yamlFrontmatter: `---\n` +
        `title: {{title|Titel des Dokuments}}\n` +
        `tags: {{tags|Relevante Tags}}\n` +
        `date: {{date|Datum im Format yyyy-mm-dd}}\n` +
        `---`,
      markdownBody: `# {{title}}\n\n## Zusammenfassung\n{{summary|Kurze Zusammenfassung des Inhalts}}\n\n## Details\n{{details|Detaillierte Beschreibung}}`,
      systemPrompt: `You are a specialized assistant that processes and structures information clearly and concisely.\n\nIMPORTANT: Your response must be a valid JSON object where each key corresponds to a template variable.`,
    }
  }

  // Template-Daten laden wenn sich die Auswahl ändert
  useEffect(() => {
    if (selectedTemplate) {
      form.reset({
        name: selectedTemplate.name,
        yamlFrontmatter: selectedTemplate.yamlFrontmatter,
        markdownBody: selectedTemplate.markdownBody,
        systemPrompt: selectedTemplate.systemPrompt,
      })
    }
  }, [selectedTemplate, form])

  // Ordner-Erstellung/Suche memoisiert, damit als Dep verwendbar
  const ensureTemplatesFolder = useCallback(async (): Promise<string> => {
    if (!providerInstance || !activeLibrary) {
      throw new Error("Keine aktive Bibliothek oder Provider verfügbar");
    }

    try {
      console.log('[TemplateManagement] Suche nach Templates-Ordner...');
      const rootItems = await listItems('root');
      const templatesFolder = rootItems.find(item => 
        item.type === 'folder' && item.metadata.name === 'templates'
      );
      if (templatesFolder) {
        console.log('[TemplateManagement] Templates-Ordner gefunden:', templatesFolder.id);
        return templatesFolder.id;
      }
      console.log('[TemplateManagement] Templates-Ordner nicht gefunden, erstelle neuen...');
      const newFolder = await providerInstance.createFolder('root', 'templates');
      console.log('[TemplateManagement] Neuer Templates-Ordner erstellt:', newFolder.id);
      return newFolder.id;
    } catch (error) {
      console.error('Fehler beim Erstellen des Templates-Ordners:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });
      let errorMessage = 'Fehler beim Erstellen des Templates-Ordners';
      if (error instanceof Error) {
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um den Templates-Ordner zu erstellen.';
        } else if (error.message.includes('Keine Berechtigung')) {
          errorMessage = 'Keine Berechtigung zum Erstellen von Ordnern in der Bibliothek.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden.';
        } else {
          errorMessage = `Fehler beim Erstellen des Templates-Ordners: ${error.message}`;
        }
      }
      throw new Error(errorMessage);
    }
  }, [providerInstance, activeLibrary, listItems]);

  // Templates laden mit der gleichen Logik wie Library-Komponente
  const loadTemplates = useCallback(async () => {
    if (!providerInstance || libraryStatus !== 'ready' || !activeLibrary) {
      console.log('[TemplateManagement] loadTemplates übersprungen:', {
        hasProvider: !!providerInstance,
        libraryStatus,
        hasActiveLibrary: !!activeLibrary
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('[TemplateManagement] Starte Prompt-Loading:', {
        libraryId: activeLibrary.id,
        libraryPath: activeLibrary.path,
        providerName: providerInstance.name
      });

      // 1. Templates-Ordner finden oder erstellen
      const folderId = await ensureTemplatesFolder();
      setTemplatesFolderId(folderId);

      console.log('[TemplateManagement] Templates-Ordner gefunden/erstellt:', folderId);

      // 2. Alle Template-Dateien im Ordner auflisten
      const items = await listItems(folderId);
      const templateFiles = items.filter(item => 
        item.type === 'file' && 
        item.metadata.name.endsWith('.md')
      );

      console.log('[TemplateManagement] Prompt-Dateien gefunden:', templateFiles.length);

      // 3. Template-Inhalte laden
      const templatePromises = templateFiles.map(async (file) => {
        try {
          const { blob } = await providerInstance.getBinary(file.id);
          const content = await blob.text();
          const template = parseTemplateContent(content, file.metadata.name.replace('.md', ''));
          
          return {
            ...template,
            fileId: file.id,
            lastModified: typeof file.metadata.modifiedAt === 'string' 
              ? file.metadata.modifiedAt 
              : file.metadata.modifiedAt instanceof Date 
                ? file.metadata.modifiedAt.toISOString()
                : new Date().toISOString()
          } as Template;
        } catch (error) {
          console.error(`Fehler beim Parsen von ${file.metadata.name}:`, error);
          return null;
        }
      });

      const loadedTemplates = await Promise.all(templatePromises);
      const validTemplates = loadedTemplates.filter((t): t is Template => t !== null);
      
      setTemplates(validTemplates);
      
      console.log('[TemplateManagement] Prompts erfolgreich geladen:', validTemplates.length);
      
      if (validTemplates.length === 0) {
        toast({
          title: "Keine Prompts gefunden",
          description: "Erstellen Sie Ihren ersten Prompt im Verzeichnis '/templates'.",
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Prompts:', {
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 3)
        } : error,
        libraryId: activeLibrary?.id,
        libraryPath: activeLibrary?.path,
        providerName: providerInstance?.name
      });

      let errorMessage = 'Unbekannter Fehler beim Laden der Prompts';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Spezifische Fehlermeldungen für häufige Probleme
        if (error.message.includes('Nicht authentifiziert')) {
          errorMessage = 'Bitte authentifizieren Sie sich bei Ihrem Cloud-Speicher, um Prompts zu laden.';
        } else if (error.message.includes('Bibliothek nicht gefunden')) {
          errorMessage = 'Die ausgewählte Bibliothek wurde nicht gefunden. Bitte überprüfen Sie die Bibliothekskonfiguration.';
        } else if (error.message.includes('Server-Fehler')) {
          errorMessage = 'Server-Fehler beim Laden der Prompts. Bitte überprüfen Sie, ob der Bibliothekspfad existiert und zugänglich ist.';
        } else if (error.message.includes('Keine aktive Bibliothek')) {
          errorMessage = 'Keine aktive Bibliothek verfügbar. Bitte wählen Sie eine Bibliothek aus.';
        }
      }
      
      setError(errorMessage);
      toast({
        title: "Fehler beim Laden der Prompts",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [providerInstance, libraryStatus, activeLibrary, listItems, setTemplates, setTemplatesFolderId, setIsLoading, setError, toast, ensureTemplatesFolder]);

  // Effect für Template Loading (wie Library-Komponente)
  useEffect(() => {
    const isReady = providerInstance && libraryStatus === 'ready' && activeLibrary
    
    if (!isReady) {
      return
    }

    // Templates laden wenn noch nicht geladen
    if (!templatesFolderId) {
      loadTemplates()
    }
  }, [providerInstance, libraryStatus, activeLibrary, templatesFolderId, loadTemplates])

  // Reset wenn sich die Library ändert
  useEffect(() => {
    setSelectedTemplateName(null)
    setTemplatesFolderId(null)
    setTemplates([])
    setError(null)
  }, [libraryStatus, setSelectedTemplateName, setTemplatesFolderId, setTemplates, setError])

  useEffect(() => {
    async function loadSelectedContext() {
      if (!providerInstance || !Array.isArray(selectedContextIds) || selectedContextIds.length === 0) {
        setSelectedContextMarkdown("")
        return
      }
      try {
        const parts: string[] = []
        for (const id of selectedContextIds) {
          const { blob } = await providerInstance.getBinary(id)
          const text = await blob.text()
          parts.push(text)
        }
        setSelectedContextMarkdown(parts.join("\n\n---\n\n"))
      } catch (e) {
        console.error('Fehler beim Laden des Kontextes', e)
        setSelectedContextMarkdown("")
      }
    }
    void loadSelectedContext()
  }, [providerInstance, selectedContextIds])

  function parseTemplateContent(content: string, fileName: string): Template {
    // Template in drei Bereiche aufteilen
    const parts = content.split('--- systemprompt')
    
    let yamlFrontmatter = ""
    let markdownBody = ""
    let systemPrompt = ""
    
    if (parts.length >= 2) {
      const mainContent = parts[0].trim()
      systemPrompt = parts[1].trim()
      
      // YAML Frontmatter extrahieren
      const yamlMatch = mainContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        // Kein YAML Frontmatter gefunden
        markdownBody = mainContent
      }
    } else {
      // Kein Systemprompt gefunden
      const yamlMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (yamlMatch) {
        yamlFrontmatter = `---\n${yamlMatch[1]}\n---`
        markdownBody = yamlMatch[2].trim()
      } else {
        markdownBody = content
      }
    }

    return {
      name: fileName,
      yamlFrontmatter,
      markdownBody,
      systemPrompt,
    }
  }

  function generateTemplateContent(values: TemplateFormValues): string {
    let content = ""
    
    // YAML Frontmatter hinzufügen
    if (values.yamlFrontmatter.trim()) {
      content += values.yamlFrontmatter + "\n\n"
    }
    
    // Markdown Body hinzufügen
    content += values.markdownBody
    
    // System Prompt hinzufügen
    if (values.systemPrompt.trim()) {
      content += "\n\n--- systemprompt\n" + values.systemPrompt
    }
    
    return content
  }

  async function onSubmit(data: TemplateFormValues) {
    if (!activeLibrary || !templatesFolderId || !providerInstance) {
      toast({
        title: "Fehler",
        description: "Keine aktive Bibliothek oder Templates-Ordner nicht gefunden.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)
    try {
      const templateContent = generateTemplateContent(data)
      const fileName = `${data.name}.md`
      
      // Datei als Blob erstellen
      const blob = new Blob([templateContent], { type: 'text/markdown' })
      const file = new File([blob], fileName, { type: 'text/markdown' })
      
      // Datei hochladen
      await providerInstance.uploadFile(templatesFolderId, file)
      
      // Templates neu laden
      await loadTemplates()
      
      // Auswahl auf das neue Template setzen
      setSelectedTemplateName(data.name)
      
      toast({
        title: "Template gespeichert",
        description: `Template "${data.name}" wurde erfolgreich im Verzeichnis "/templates" gespeichert.`,
      })
    } catch (error) {
      console.error('Fehler beim Speichern des Templates:', error)
      toast({
        title: "Fehler beim Speichern",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function renameCurrentTemplate() {
    const current = selectedTemplateName ? templates.find(t => t.name === selectedTemplateName) : null
    if (!current || !current.fileId || !providerInstance) return
    const newName = (window.prompt('Neuen Namen eingeben:', current.name) || '').trim()
    if (!newName || newName === current.name) return
    if (/[^a-zA-Z0-9._\- ]/.test(newName)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === newName.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    try {
      await providerInstance.renameItem(current.fileId, `${newName}.md`)
      await loadTemplates()
      setSelectedTemplateName(newName)
      form.setValue('name', newName, { shouldDirty: false })
      toast({ title: 'Umbenannt', description: `${current.name} → ${newName}` })
    } catch (e) {
      toast({ title: 'Fehler beim Umbenennen', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
    }
  }

  async function deleteTemplate(templateName: string) {
    if (!activeLibrary || !providerInstance) return

    try {
      const template = templates.find(t => t.name === templateName)
      if (!template?.fileId) {
        throw new Error("Template-Datei nicht gefunden")
      }

      // Datei löschen
      await providerInstance.deleteItem(template.fileId)

      // Templates neu laden
      await loadTemplates()
      
      if (selectedTemplateName === templateName) {
        setSelectedTemplateName(null)
        form.reset()
      }
      
      toast({
        title: "Template gelöscht",
        description: `Template "${templateName}" wurde erfolgreich gelöscht.`,
      })
    } catch (error) {
      console.error('Fehler beim Löschen des Templates:', error)
      toast({
        title: "Fehler beim Löschen",
        description: error instanceof Error ? error.message : "Unbekannter Fehler",
        variant: "destructive",
      })
    }
  }

  async function createNewTemplate() {
    const name = (window.prompt('Neuen Template‑Namen eingeben:') || '').trim()
    if (!name) return
    if (/[^a-zA-Z0-9._\- ]/.test(name)) { toast({ title: 'Ungültiger Name', description: 'Nur Buchstaben, Zahlen, Leerzeichen, . _ - sind erlaubt.', variant: 'destructive' }); return }
    if (templates.some(t => t.name.toLowerCase() === name.toLowerCase())) { toast({ title: 'Bereits vorhanden', description: 'Bitte anderen Namen wählen.', variant: 'destructive' }); return }
    if (!providerInstance) { toast({ title: 'Kein Provider' , variant: 'destructive' }); return }
    try {
      const folderId = await ensureTemplatesFolder()
      const values = getDefaultTemplateValues(name)
      const content = (values.yamlFrontmatter ? values.yamlFrontmatter + '\n\n' : '') + values.markdownBody + '\n\n--- systemprompt\n' + values.systemPrompt
      const file = new File([new Blob([content], { type: 'text/markdown' })], `${name}.md`, { type: 'text/markdown' })
      await providerInstance.uploadFile(folderId, file)
      await loadTemplates()
      setSelectedTemplateName(name)
      form.reset(values)
      toast({ title: 'Template angelegt', description: `"${name}" wurde erstellt.` })
    } catch (e) {
      toast({ title: 'Fehler beim Anlegen', description: e instanceof Error ? e.message : 'Unbekannter Fehler', variant: 'destructive' })
    }
  }

  function generatePreview(): string {
    const values = form.getValues()
    return generateTemplateContent(values)
  }

  async function testTemplate() {
    if (!activeLibrary) return

    setIsTesting(true)
    setTestResult(null)

    const values = form.getValues()
    const templateContent = generateTemplateContent(values)
    const testText = selectedContextMarkdown || ""

    try {
      const response = await fetch('/api/secretary/process-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Library-Id': activeLibrary.id,
        },
        body: new URLSearchParams({
          text: testText,
          template_content: templateContent,
          source_language: 'de',
          target_language: 'de',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()
      const formattedResult = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
      setTestResult(formattedResult)

      toast({
        title: "Prompt-Test erfolgreich",
        description: "Der Prompt wurde erfolgreich mit dem gewählten Kontext verarbeitet.",
      })

      console.log('Prompt-Test Ergebnis:', result)
    } catch (error) {
      console.error('Fehler beim Prompt-Test:', error)
      const errorMessage = error instanceof Error ? error.message : "Unbekannter Fehler"
      setTestResult(`Fehler: ${errorMessage}`)
      toast({
        title: "Prompt-Test fehlgeschlagen",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  // Render-Logik für verschiedene Status
  if (libraryStatus === "waitingForAuth") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Diese Bibliothek benötigt eine Authentifizierung.</span>
        <span className="text-sm mt-2">Bitte konfigurieren Sie die Bibliothek in den Einstellungen.</span>
      </div>
    )
  }
  
  if (libraryStatus !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <span>Lade Storage...</span>
      </div>
    )
  }

  if (!activeLibrary) {
    return (
      <div className="text-center text-muted-foreground">
        Bitte wählen Sie eine Bibliothek aus.
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center text-destructive">
        <p>Fehler beim Laden der Prompts:</p>
        <p className="text-sm">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={loadTemplates}
        >
          Erneut versuchen
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Kompakte Toolbar oben */}
      <div className="flex items-center gap-2">
        <Select value={selectedTemplateName || ''} onValueChange={(v) => { setSelectedTemplateName(v); form.setValue('name', v, { shouldDirty: false }) }} disabled={isLoading}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Prompt auswählen..." />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Info className="h-4 w-4" /></Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /><span>Ort: /templates in „{activeLibrary.label}“</span></div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button type="button" variant="outline" size="sm" onClick={createNewTemplate} disabled={isLoading}>Neu</Button>
        <Button type="button" variant="outline" size="sm" onClick={renameCurrentTemplate} disabled={!selectedTemplateName}>Umbenennen</Button>
        {selectedTemplateName && (
          <Button type="button" variant="destructive" size="sm" onClick={() => deleteTemplate(selectedTemplateName!)}>Löschen</Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Prompt Design</CardTitle>
            <CardDescription>
              Drei Bereiche: Aufgabe (was), Rollenanweisung (wie), Metadaten (Begleitinfos).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Template-Name Feld entfernt (oben verwaltet) */}

              {previewMode ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Prompt-Vorschau</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewMode(false)}
                    >
                      Bearbeiten
                    </Button>
                  </div>
                  <div className="border rounded-md p-4 bg-muted/50">
                    <pre className="text-sm whitespace-pre-wrap font-mono">
                      {generatePreview()}
                    </pre>
                  </div>
                </div>
              ) : (
                <StructuredTemplateEditor
                  markdownBody={form.watch('markdownBody')}
                  yamlFrontmatter={form.watch('yamlFrontmatter')}
                  systemPrompt={form.watch('systemPrompt')}
                  onChange={({ markdownBody, yamlFrontmatter, systemPrompt }) => {
                    form.setValue('markdownBody', markdownBody, { shouldDirty: true })
                    form.setValue('yamlFrontmatter', yamlFrontmatter, { shouldDirty: true })
                    form.setValue('systemPrompt', systemPrompt, { shouldDirty: true })
                  }}
                />
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {previewMode ? "Bearbeiten" : "Vorschau"}
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !form.formState.isDirty}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Speichern
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prompt testen</CardTitle>
            <CardDescription>
              Test mit Beispieltext. Nutzt Rollenanweisung, Aufgabe und Metadaten des Prompts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Kontext-Texte</Label>
                <div className="border rounded p-2 max-h-40 overflow-auto text-sm">
                  {Array.isArray(contextDocs) && contextDocs.length > 0 ? (
                    contextDocs.map(d => {
                      const checked = selectedContextIds.includes(d.id)
                      return (
                        <label key={d.id} className="flex items-center gap-2 py-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const isOn = v === true
                              setSelectedContextIds(prev => isOn ? [...prev, d.id] : prev.filter(x => x !== d.id))
                            }}
                          />
                          <span className="truncate">{d.name}</span>
                        </label>
                      )
                    })
                  ) : (
                    <div className="text-muted-foreground text-sm">Keine Kontext-Texte verfügbar</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Gewählter Kontext (Lesemodus)</Label>
                <div className="border rounded-md">
                  <MarkdownPreview content={selectedContextMarkdown} className="max-h-64 overflow-auto" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prompt‑Vorschau (Aufgabe als Markdown)</Label>
                <div className="border rounded-md">
                  <MarkdownPreview content={form.watch('markdownBody') || ''} className="max-h-64 overflow-auto" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={testTemplate}
                  disabled={!selectedTemplateName || isTesting}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Teste...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Prompt testen
                    </>
                  )}
                </Button>
              </div>
              
              {testResult && (
                <div className="space-y-2">
                  <Label>Ergebnis (Markdown)</Label>
                  <div className="border rounded-md">
                    <MarkdownPreview content={testResult} className="max-h-80 overflow-auto" />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
```

Ich öffne die betroffene Datei, um die Funktionsdeklaration innerhalb eines Blocks in eine `const`-Funktionszuweisung umzuschreiben. Danach starte ich erneut den Build.

Ich konvertiere die Funktionsdeklarationen `submitOne` und `worker` in `const`-Funktionsausdrücke, um den ES5-Strict-Mode-Fehler zu beheben, und starte danach den Build.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Serverseitige Parallelität begrenzen (z. B. 5)
    const concurrency = 5;
    // Eindeutige Batch-ID generieren, für zuverlässiges Grouping unabhängig vom Namen
    const batchId = crypto.randomUUID();

    // Worker-Funktion: reiche einzelne Datei weiter an process-pdf
    const submitOne = async (it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> => {
      try {
        // Hole Datei-Binärdaten via interner API, um Code-Duplizierung zu vermeiden
        // Wir nutzen die bestehende Client-Route, indem wir eine FormData bauen und lokal requesten
        // Vorteil: die gesamte Job-Anlage/Idempotenz bleibt an einem Ort
        const fd = new FormData();
        // Holen der Datei aus dem Storage muss in der Zielroute passieren; hier nur Metadaten weitergeben
        // Aber unsere bestehende process-pdf Route erwartet die Datei bereits. Daher rufen wir sie nicht direkt hier,
        // sondern nutzen einen vereinfachten Pfad: Der Client übergibt im Normalfall Binärdaten.
        // Für serverseitige Batch-Einreichung wählen wir den robusteren Weg: lade die Datei serverseitig und reiche mit.
        const { getServerProvider } = await import('@/lib/storage/server-provider');
        const provider = await getServerProvider(userEmail, libraryId);
        const bin = await provider.getBinary(it.fileId);
        const blob = bin.blob;
        const file = new File([blob], it.name || bin.name || 'document.pdf', { type: it.mimeType || bin.mimeType || 'application/pdf' });

        fd.append('file', file);
        fd.append('originalItemId', it.fileId);
        fd.append('parentId', it.parentId);
        if (options?.targetLanguage) fd.append('targetLanguage', options.targetLanguage);
        if (options?.extractionMethod) fd.append('extractionMethod', options.extractionMethod);
        if (typeof options?.includeImages === 'boolean') fd.append('includeImages', String(options.includeImages));
        if (typeof options?.useCache === 'boolean') fd.append('useCache', String(options.useCache));
        if (typeof options?.template === 'string') fd.append('template', options.template);
        if (typeof options?.doExtractMetadata === 'boolean') fd.append('doExtractMetadata', String(options.doExtractMetadata));
        if (typeof options?.doIngestRAG === 'boolean') fd.append('doIngestRAG', String(options.doIngestRAG));
        if (typeof options?.forceRecreate === 'boolean') fd.append('forceRecreate', String(options.forceRecreate));
        if (batchName) fd.append('batchName', batchName);
        fd.append('batchId', batchId);
        // Wichtig: Phase 1 standardmäßig aktivieren, damit Secretary aufgerufen wird
        fd.append('doExtractPDF', 'true');

        const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
          method: 'POST',
          headers: {
            'X-Library-Id': libraryId,
            // Clerk-Session weiterreichen, damit die Zielroute authentifiziert ist
            'Cookie': request.headers.get('cookie') || ''
          },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg };
        }
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const jobId = typeof (json as { job?: { id?: string } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : undefined;
        return jobId ? { ok: true, jobId } : { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }

    // Einfache Concurrency-Queue
    const results: Array<{ ok: boolean; jobId?: string; error?: string }> = [];
    let index = 0;
    const worker = async () => {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        const r = await submitOne(items[i]);
        results[i] = r;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    const okCount = results.filter(r => r?.ok).length;
    const failCount = results.length - okCount;
    FileLogger.info('process-pdf-batch', 'Batch abgeschlossen', { okCount, failCount, batchName, batchId, total: items.length });

    return NextResponse.json({ ok: true, batchId, batchName, okCount, failCount, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

Ich passe die benannte Datei an, um den Zugriff auf ein nicht existentes Feld zu entfernen, und starte danach erneut den Build.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuth, currentUser } from '@clerk/nextjs/server';
import { FileLogger } from '@/lib/debug/logger';
import crypto from 'crypto';

// Batch-Submit: Erwartet JSON mit items[] (each: { fileId, parentId, name, mimeType }) und optionalen Optionen/Batch-Metadaten
// Server lädt Binärdaten per Server-Storage, reicht an die bestehende process-pdf Route weiter.

interface BatchItemInput {
  fileId: string;
  parentId: string;
  name?: string;
  mimeType?: string;
}

interface BatchRequestBody {
  libraryId: string;
  batchName?: string;
  options?: {
    targetLanguage?: string;
    extractionMethod?: string;
    includeImages?: boolean;
    useCache?: boolean;
    template?: string;
    doExtractMetadata?: boolean;
    doIngestRAG?: boolean;
    forceRecreate?: boolean;
  };
  items: BatchItemInput[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    if (!userId) return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    const user = await currentUser();
    const userEmail = user?.emailAddresses?.[0]?.emailAddress || '';
    if (!userEmail) return NextResponse.json({ error: 'Benutzer-E-Mail nicht verfügbar' }, { status: 403 });

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type application/json erwartet' }, { status: 415 });
    }

    const body = await request.json() as unknown as BatchRequestBody;
    const libraryId = typeof body?.libraryId === 'string' ? body.libraryId : '';
    const items = Array.isArray(body?.items) ? body.items : [];
    const batchName = typeof body?.batchName === 'string' ? body.batchName : undefined;
    const options = body?.options || {};
    if (!libraryId || items.length === 0) {
      return NextResponse.json({ error: 'libraryId und items erforderlich' }, { status: 400 });
    }

    // Serverseitige Parallelität begrenzen (z. B. 5)
    const concurrency = 5;
    // Eindeutige Batch-ID generieren, für zuverlässiges Grouping unabhängig vom Namen
    const batchId = crypto.randomUUID();

    // Worker-Funktion: reiche einzelne Datei weiter an process-pdf
    const submitOne = async (it: BatchItemInput): Promise<{ ok: boolean; jobId?: string; error?: string }> => {
      try {
        // Hole Datei-Binärdaten via interner API, um Code-Duplizierung zu vermeiden
        // Wir nutzen die bestehende Client-Route, indem wir eine FormData bauen und lokal requesten
        // Vorteil: die gesamte Job-Anlage/Idempotenz bleibt an einem Ort
        const fd = new FormData();
        // Holen der Datei aus dem Storage muss in der Zielroute passieren; hier nur Metadaten weitergeben
        // Aber unsere bestehende process-pdf Route erwartet die Datei bereits. Daher rufen wir sie nicht direkt hier,
        // sondern nutzen einen vereinfachten Pfad: Der Client übergibt im Normalfall Binärdaten.
        // Für serverseitige Batch-Einreichung wählen wir den robusteren Weg: lade die Datei serverseitig und reiche mit.
        const { getServerProvider } = await import('@/lib/storage/server-provider');
        const provider = await getServerProvider(userEmail, libraryId);
        const bin = await provider.getBinary(it.fileId);
        const blob = bin.blob;
        const filename = it.name || 'document.pdf';
        const file = new File([blob], filename, { type: it.mimeType || bin.mimeType || 'application/pdf' });

        fd.append('file', file);
        fd.append('originalItemId', it.fileId);
        fd.append('parentId', it.parentId);
        if (options?.targetLanguage) fd.append('targetLanguage', options.targetLanguage);
        if (options?.extractionMethod) fd.append('extractionMethod', options.extractionMethod);
        if (typeof options?.includeImages === 'boolean') fd.append('includeImages', String(options.includeImages));
        if (typeof options?.useCache === 'boolean') fd.append('useCache', String(options.useCache));
        if (typeof options?.template === 'string') fd.append('template', options.template);
        if (typeof options?.doExtractMetadata === 'boolean') fd.append('doExtractMetadata', String(options.doExtractMetadata));
        if (typeof options?.doIngestRAG === 'boolean') fd.append('doIngestRAG', String(options.doIngestRAG));
        if (typeof options?.forceRecreate === 'boolean') fd.append('forceRecreate', String(options.forceRecreate));
        if (batchName) fd.append('batchName', batchName);
        fd.append('batchId', batchId);
        // Wichtig: Phase 1 standardmäßig aktivieren, damit Secretary aufgerufen wird
        fd.append('doExtractPDF', 'true');

        const res = await fetch(new URL('/api/secretary/process-pdf', request.url).toString(), {
          method: 'POST',
          headers: {
            'X-Library-Id': libraryId,
            // Clerk-Session weiterreichen, damit die Zielroute authentifiziert ist
            'Cookie': request.headers.get('cookie') || ''
          },
          body: fd,
        });
        if (!res.ok) {
          const msg = await res.text().catch(() => res.statusText);
          return { ok: false, error: msg };
        }
        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const jobId = typeof (json as { job?: { id?: string } }).job?.id === 'string' ? (json as { job: { id: string } }).job.id : undefined;
        return jobId ? { ok: true, jobId } : { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    }

    // Einfache Concurrency-Queue
    const results: Array<{ ok: boolean; jobId?: string; error?: string }> = [];
    let index = 0;
    const worker = async () => {
      while (true) {
        const i = index++;
        if (i >= items.length) break;
        const r = await submitOne(items[i]);
        results[i] = r;
      }
    }
    const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
    await Promise.all(workers);

    const okCount = results.filter(r => r?.ok).length;
    const failCount = results.length - okCount;
    FileLogger.info('process-pdf-batch', 'Batch abgeschlossen', { okCount, failCount, batchName, batchId, total: items.length });

    return NextResponse.json({ ok: true, batchId, batchName, okCount, failCount, results });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unerwarteter Fehler' }, { status: 500 });
  }
}



```

- Build läuft jetzt erfolgreich durch. Es bleiben nur React-Hook-Warnungen, die den Build nicht blockieren.

Kurzupdate:
- Ich habe die Typfehler in `retry/route.ts` und `process-pdf/batch/route.ts` behoben (kein Zugriff mehr auf `bin.name`).
- Ungenutzte Importe in `combined-chat-dialog.tsx` und `template-management.tsx` entfernt.
- Strict-Mode-Fehler behoben, indem Funktionsdeklarationen in `const`-Zuweisungen geändert wurden.
- Build mehrfach gestartet; der letzte Durchlauf war erfolgreich.

Tests/Verifikation:
- `pnpm build` lief fehlerfrei durch. Die aufgelisteten ESLint-Warnungen betreffen Hook-Dependencies und blockieren nicht.

