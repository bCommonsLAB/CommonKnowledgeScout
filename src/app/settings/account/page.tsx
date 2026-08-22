/**
 * @fileoverview Seite „Mein Zugang" — account-weite Einstellungen.
 *
 * @description
 * Erster Account-Bereich der Settings (bisher war alles library-spezifisch):
 * Werte, die pro PERSON gelten, nicht pro Bibliothek. Heute: der MCP-Zugang
 * fuer Claude (Erweiterungs-Download). Kandidat fuer spaeter: eigene
 * Storage-Zugangsdaten der Co-Creator (ADR 0005).
 */

import { McpBridgeSection } from "@/components/settings/account/mcp-bridge-section"

export default function AccountSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Mein Zugang</h3>
        <p className="text-sm text-muted-foreground">
          Einstellungen für dein Konto — unabhängig von der ausgewählten Bibliothek.
        </p>
      </div>
      <McpBridgeSection />
    </div>
  )
}
