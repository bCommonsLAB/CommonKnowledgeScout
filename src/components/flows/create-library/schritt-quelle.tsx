"use client"

/**
 * Wizard-Schritt Quelle (C2): Speichertyp, Speicher-Verbindung des Kontos,
 * Verzeichnis, Verbindungstest. Typ-Zweige sind hier erlaubt
 * (welle-3-iv-settings-contracts §4: Konfigurationsformular).
 */

import Link from "next/link"
import { useState } from "react"
import { Button, Input, Label, toast } from "@ks/ui"
import { useAccountConnections } from "@/components/settings/storage/hooks/use-account-connections"
import { SPEICHER_TYPEN, type SpeicherTyp } from "@/lib/library-setup/entwurf"
import type { StorageConnectionSummary } from "@/types/storage-connection"
import type { SchrittProps } from "./schritt-props"

const TYP_LABEL: Record<SpeicherTyp, string> = { nextcloud: "Nextcloud", onedrive: "OneDrive", local: "Lokales Verzeichnis (Server)" }

export function SchrittQuelle({ antworten, setze }: SchrittProps) {
  const { connections, connectionsError, reloadConnections } = useAccountConnections()
  const [testet, setTestet] = useState(false)
  const passende = (connections ?? []).filter((c) => c.type === antworten.speicherTyp)
  const gewaehlt = passende.find((c) => c.id === antworten.verbindungId)

  async function testen(): Promise<void> {
    if (!gewaehlt) return
    setTestet(true)
    try {
      const response = await fetch(`/api/account/storage-connections/${encodeURIComponent(gewaehlt.id)}/test`, { method: "POST" })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const ergebnis = (await response.json()) as StorageConnectionSummary
      toast({ title: ergebnis.lastTest?.ok ? "Verbindung ok" : "Verbindung fehlgeschlagen", description: ergebnis.lastTest?.message ?? "" })
      await reloadConnections()
    } catch (error) {
      console.error("[CreateLibraryWizard] Verbindungstest fehlgeschlagen:", error)
      toast({ title: "Test fehlgeschlagen", description: error instanceof Error ? error.message : String(error), variant: "destructive" })
    } finally {
      setTestet(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Label>Wo liegen die Dateien? *</Label>
        <div className="flex gap-2">
          {SPEICHER_TYPEN.map((typ) => (
            <Button key={typ} type="button" size="sm" variant={antworten.speicherTyp === typ ? "default" : "outline"} onClick={() => setze({ speicherTyp: typ, verbindungId: "" })}>
              {TYP_LABEL[typ]}
            </Button>
          ))}
        </div>
      </div>

      {antworten.speicherTyp !== "local" && (
        <div className="grid gap-2">
          <Label htmlFor="wizard-verbindung">Speicher-Verbindung *</Label>
          {connectionsError && <p className="text-xs text-destructive">Verbindungen nicht ladbar: {connectionsError}</p>}
          <div className="flex items-center gap-2">
            <select
              id="wizard-verbindung"
              className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
              value={antworten.verbindungId}
              onChange={(e) => setze({ verbindungId: e.target.value })}
            >
              <option value="">{connections === null ? "lädt …" : passende.length === 0 ? "— keine Verbindung dieses Typs —" : "— wählen —"}</option>
              {passende.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <Button type="button" size="sm" variant="outline" disabled={!gewaehlt || testet} onClick={() => void testen()}>
              {testet ? "Testet …" : "Testen"}
            </Button>
          </div>
          {gewaehlt?.lastTest && (
            <p className={`text-xs ${gewaehlt.lastTest.ok ? "text-muted-foreground" : "text-destructive"}`}>
              Letzter Test: {gewaehlt.lastTest.ok ? "ok" : "fehlgeschlagen"} — {gewaehlt.lastTest.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Zugangsdaten gehören Ihrem Konto. Neue Verbindung anlegen:{" "}
            <Link href="/settings/account/storage-connections" target="_blank" className="underline">Konto → Speicher-Verbindungen</Link>
            {" "}— danach <button type="button" className="underline" onClick={() => void reloadConnections()}>neu laden</button>.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="wizard-verzeichnis">{antworten.speicherTyp === "local" ? "Absoluter Pfad auf dem Server *" : "Verzeichnis auf der Verbindung"}</Label>
        <Input
          id="wizard-verzeichnis"
          placeholder={antworten.speicherTyp === "local" ? "/data/archiv" : "/Archiv"}
          value={antworten.verzeichnis}
          onChange={(e) => setze({ verzeichnis: e.target.value })}
        />
        {antworten.speicherTyp !== "local" && (
          <p className="text-xs text-muted-foreground">Leer = Wurzel der Verbindung. Auswahl per Ordner-Picker danach unter Archive · 1 Quelle.</p>
        )}
      </div>
    </div>
  )
}
