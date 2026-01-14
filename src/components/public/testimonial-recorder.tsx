"use client"

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { DictationTextarea } from '@/components/shared/dictation-textarea'

type SaveState = 'idle' | 'saving' | 'done' | 'error'

export function PublicTestimonialRecorder() {
  const sp = useSearchParams()
  const libraryId = sp?.get('libraryId') || ''
  const eventFileId = sp?.get('eventFileId') || ''
  const writeKey = sp?.get('writeKey') || ''

  const [speakerName, setSpeakerName] = React.useState('')
  const [consent, setConsent] = React.useState<boolean>(false)
  const [text, setText] = React.useState<string>('')
  const [dictationAudio, setDictationAudio] = React.useState<{ blob: Blob; mimeType: string } | null>(null)

  const [state, setState] = React.useState<SaveState>('idle')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    return () => {
      // keine Cleanup-Notwendigkeit hier; DictationTextarea kümmert sich um Streams.
    }
  }, [])

  async function save(): Promise<void> {
    setError(null)
    if (!libraryId || !eventFileId) {
      setError('Fehlende Parameter: libraryId oder eventFileId.')
      setState('error')
      return
    }
    if (!consent) {
      setError('Bitte bestätige zuerst dein Einverständnis.')
      setState('error')
      return
    }
    if (!text.trim() && !dictationAudio) {
      setError('Bitte Text eingeben oder diktieren.')
      setState('error')
      return
    }

    try {
      setState('saving')

      const fd = new FormData()
      fd.append('libraryId', libraryId)
      fd.append('eventFileId', eventFileId)
      if (writeKey) fd.append('writeKey', writeKey)
      if (speakerName.trim()) fd.append('speakerName', speakerName.trim())
      fd.append('consent', String(consent))
      if (text.trim()) fd.append('text', text.trim())
      if (dictationAudio) {
        fd.append('file', new File([dictationAudio.blob], 'dictation.webm', { type: dictationAudio.mimeType || 'audio/webm' }))
      }

      const res = await fetch('/api/public/testimonials', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        const msg = typeof (json as { error?: unknown })?.error === 'string' ? String((json as { error: string }).error) : `HTTP ${res.status}`
        throw new Error(msg)
      }

      toast.success('Danke! Dein Testimonial wurde gespeichert.')
      setState('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error('Upload fehlgeschlagen', { description: msg })
      setState('error')
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Testimonial erfassen</CardTitle>
        <CardDescription>
          Du kannst tippen oder diktieren. Vor dem Speichern kannst du den Text korrigieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!libraryId || !eventFileId ? (
          <div className="text-sm text-destructive">
            Diese Seite wurde ohne Kontext geöffnet. Bitte nutze den QR-Code vom Event.
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="speakerName">Name (optional)</Label>
          <Input
            id="speakerName"
            value={speakerName}
            onChange={(e) => setSpeakerName(e.target.value)}
            placeholder="z.B. Max Mustermann"
            disabled={state === 'saving' || state === 'done'}
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="consent"
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            disabled={state === 'saving' || state === 'done'}
          />
          <Label htmlFor="consent">Ich bin einverstanden, dass meine Stimme genutzt wird.</Label>
        </div>

        <DictationTextarea
          label="Was war dein Eindruck und was nimmst du mit? (Optional: Eine Botschaft für deine Nachkommen – warum ist das wichtig?)"
          value={text}
          onChange={setText}
          disabled={state === 'saving' || state === 'done'}
          onDictationAudio={({ blob, mimeType }) => setDictationAudio({ blob, mimeType })}
          rows={7}
          placeholder="Schreibe hier dein Testimonial…"
          showOscilloscope={true}
          transcribeEndpoint="/api/public/secretary/process-audio"
          extraFormFields={{
            libraryId,
            eventFileId,
            ...(writeKey ? { writeKey } : {}),
          }}
        />

        {error ? <div className="text-sm text-destructive">{error}</div> : null}

        <div className="flex items-center gap-2">
          <Button onClick={() => void save()} disabled={state === 'saving' || state === 'done'}>
            Speichern
          </Button>
          {state === 'done' ? (
            <div className="text-sm text-muted-foreground">Gespeichert.</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

