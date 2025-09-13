"use client";

import { useAtom } from 'jotai'
import { useCallback, useMemo, useState } from 'react'
import { combinedChatDialogOpenAtom } from '@/atoms/combined-chat-atom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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

  const disabled = useMemo(() => loading || !provider || items.length === 0 || !libraryId, [loading, provider, items.length, libraryId])

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
          <div className="space-y-3">
            <div>
              <Label>Template</Label>
              <div className="text-sm text-muted-foreground">{selectedTemplate} · {selectedLanguage}</div>
            </div>
            <div>
              <Label htmlFor="instructions">Instruktionen</Label>
              <Textarea id="instructions" value={instructions} onChange={(e) => setInstructions(e.target.value)} className="min-h-[220px]" />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handlePreview} disabled={disabled}>{loading ? 'Lade…' : 'Antwort anzeigen'}</Button>
            </div>
          </div>

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
              {/* Platzhalter für spätere: Dokument generieren + speichern */}
              <Button disabled>Dokument generieren (später)</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


