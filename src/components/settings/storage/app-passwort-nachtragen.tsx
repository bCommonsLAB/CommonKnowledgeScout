"use client"

/**
 * AppPasswortNachtragen — fehlendes Nextcloud-App-Passwort direkt in der
 * Zusammenfassung eintragen.
 *
 * Befund 09.10.2026: Eine Library, die ueber die Bruecke angelegt wurde
 * (`bibliothek_anlegen`), hat Typ, Pfad, WebDAV-URL und Benutzer — aber
 * absichtlich kein Passwort. Weil der Pfad gesetzt ist, zeigt Settings →
 * Archive die Read-only-Zusammenfassung; das Passwort-Feld lag nur im
 * Wizard hinter „Quelle aendern…" (mit Warnung). Der Owner fand keinen Weg
 * und trug das Passwort direkt in MongoDB ein. Hier erscheint deshalb ein
 * Eingabefeld, solange kein Passwort gespeichert ist. Gespeichert wird ueber
 * denselben Weg wie im Wizard (`onSubmit` des Storage-Hooks, PATCH).
 */

import { useState } from "react"
import { Alert, AlertDescription, AlertTitle, Button, Input } from '@ks/ui'
import { KeyRound } from "lucide-react"
import type { UseStorageFormResult } from "./hooks/use-storage-form"

interface AppPasswortNachtragenProps {
  hook: UseStorageFormResult
}

export function AppPasswortNachtragen({ hook }: AppPasswortNachtragenProps) {
  const { form, onSubmit, isLoading, handleTest } = hook
  const [passwort, setPasswort] = useState("")

  const speichern = async () => {
    const wert = passwort.trim()
    if (!wert) return
    form.setValue("nextcloudAppPassword", wert)
    await onSubmit(form.getValues())
    setPasswort("")
    await handleTest()
  }

  return (
    <Alert>
      <KeyRound className="h-4 w-4" />
      <AlertTitle>App-Passwort fehlt</AlertTitle>
      <AlertDescription className="space-y-2">
        <span className="block">
          Ohne App-Passwort kann die Bibliothek nicht auf Nextcloud zugreifen
          (Nextcloud → Einstellungen → Sicherheit → Geräte &amp; Sitzungen).
        </span>
        <div className="flex gap-2">
          <Input
            type="password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            placeholder="Nextcloud App-Passwort"
            autoComplete="new-password"
          />
          <Button onClick={() => void speichern()} disabled={isLoading || passwort.trim() === ""}>
            {isLoading ? "Speichert…" : "Speichern und prüfen"}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
