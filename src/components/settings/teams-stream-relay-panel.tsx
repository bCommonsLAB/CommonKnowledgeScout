'use client'

/**
 * @fileoverview Electron-only: Teams stream.aspx-URL → Secretary über lokales MSAL + Chunk-Upload
 */

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

export function TeamsStreamRelayPanel() {
  const [isElectron, setIsElectron] = useState(false)
  const [url, setUrl] = useState('')
  const [targetLanguage, setTargetLanguage] = useState('de')
  const [sourceLanguage, setSourceLanguage] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ percent: number; message: string } | null>(null)
  const [resultJson, setResultJson] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsElectron(!!window.electronAPI?.isElectron)
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onStreamRelayProgress) return
    const off = window.electronAPI.onStreamRelayProgress((p) => {
      setProgress({
        percent: typeof p.percent === 'number' ? p.percent : 0,
        message: p.message || p.phase || '',
      })
    })
    return off
  }, [])

  const onStart = useCallback(async () => {
    setError(null)
    setResultJson(null)
    setProgress(null)
    if (!window.electronAPI?.streamRelayStart) {
      setError('electronAPI.streamRelayStart nicht verfügbar')
      return
    }
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Bitte eine stream.aspx-URL einfügen')
      return
    }
    setBusy(true)
    try {
      const res = await window.electronAPI.streamRelayStart({
        streamUrl: trimmed,
        targetLanguage: targetLanguage.trim() || 'de',
        sourceLanguage: sourceLanguage.trim() || 'auto',
      })
      if (!res.ok) {
        setError(res.error || 'Unbekannter Fehler')
        return
      }
      setResultJson(JSON.stringify(res.data, null, 2))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }, [url, targetLanguage, sourceLanguage])

  const onCancel = useCallback(async () => {
    await window.electronAPI?.streamRelayCancel?.()
  }, [])

  if (!isElectron) {
    return null
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h4 className="text-sm font-medium">Teams-Aufzeichnung (Electron → Secretary)</h4>
        <p className="text-sm text-muted-foreground mt-1">
          Füge eine SharePoint-URL mit <code className="text-xs">stream.aspx</code> ein. Die Desktop-App
          meldet sich bei Microsoft an (Scope <code className="text-xs">Files.Read</code>), lädt die Datei
          und sendet sie in Chunks an den Secretary-Service. Voraussetzung:{' '}
          <code className="text-xs">ELECTRON_MSAL_CLIENT_ID</code> in der .env und Azure-AD-Redirect für
          Desktop/Loopback.
        </p>
      </div>
      <Separator />
      <div className="space-y-2">
        <Label htmlFor="stream-relay-url">stream.aspx-URL</Label>
        <Input
          id="stream-relay-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…-my.sharepoint.com/…/stream.aspx?id=…"
          disabled={busy}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="stream-relay-target">Zielsprache</Label>
          <Input
            id="stream-relay-target"
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stream-relay-source">Quellsprache</Label>
          <Input
            id="stream-relay-source"
            value={sourceLanguage}
            onChange={(e) => setSourceLanguage(e.target.value)}
            disabled={busy}
          />
        </div>
      </div>
      {progress && (
        <div className="space-y-2">
          <Progress value={progress.percent} />
          <p className="text-xs text-muted-foreground">{progress.message}</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {resultJson && (
        <pre className="text-xs bg-muted p-2 rounded-md max-h-48 overflow-auto whitespace-pre-wrap">
          {resultJson}
        </pre>
      )}
      <div className="flex gap-2">
        <Button type="button" onClick={onStart} disabled={busy}>
          {busy ? 'Übertrage…' : 'Übertragung starten'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={!busy}>
          Abbrechen
        </Button>
      </div>
    </div>
  )
}
