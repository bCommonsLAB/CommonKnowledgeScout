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
import { useRootItems } from '@/hooks/use-root-items'

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
  const getRootItems = useRootItems()
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
          const roots = await getRootItems()
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


