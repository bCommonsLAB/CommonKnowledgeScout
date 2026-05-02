# Contracts: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Quelle: [`.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc`](../../../.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc).

## Verweis auf die neue Rule

Die harten Invarianten fuer diese Welle stehen in der Rule-Datei
[`welle-3-iii-galerie-chat-contracts.mdc`](../../../.cursor/rules/welle-3-iii-galerie-chat-contracts.mdc).

## Inhalt der Rule (Kurzfassung)

| § | Thema | Status (Ist) |
|---|---|---|
| §1 | Determinismus — UI-Komponenten sind Renderer | erfuellt (kein Service-Layer-Aufruf in der Welle) |
| §2 | Fehler-Semantik — kein leerer Catch | erfuellt (0 leere Catches) |
| §3 | Erlaubte/verbotene Abhaengigkeiten | erfuellt (Stichprobe in Inventur) |
| §4 | Skip-/Default-Semantik | erfuellt (sichtbare Empty-States in Galerie + Chat) |
| §5 | URL-State-Vertrag (Galerie + Story) | erfuellt (nuqs/useSearchParams im Einsatz) |
| §6 | Modul-Split-Vertrag (Vorbereitung) | greift in Sub-Wellen 3-III-a/b/c |
| §7 | Storage-Branches verboten | erfuellt (0 Verstoesse) |
| §8 | `'use client'`-Direktiven minimieren | dokumentiert (Ausnahmen begruendet) |
| §9 | Code-Review-Checkliste | aktiv |

## Verbindung zu globalen Rules

- [`storage-abstraction.mdc`](../../../.cursor/rules/storage-abstraction.mdc) — Welle haelt sich daran (0 Verstoesse)
- [`no-silent-fallbacks.mdc`](../../../.cursor/rules/no-silent-fallbacks.mdc) — Welle haelt sich daran (0 Verstoesse)
- [`media-lifecycle.mdc`](../../../.cursor/rules/media-lifecycle.mdc) — Galerie ist Read-Only-Konsument von Frontmatter
- [`chat-contracts.mdc`](../../../.cursor/rules/chat-contracts.mdc) — Backend-Contracts; UI ist Konsument
- [`shadow-twin-architecture.mdc`](../../../.cursor/rules/shadow-twin-architecture.mdc) — gallery-root und chat-panel lesen Shadow-Twin-State
- [`prio1-state-caching-navigation.mdc`](../../../.cursor/rules/prio1-state-caching-navigation.mdc) — URL-State-Verträge
- [`refactor-batch-strategy.mdc`](../../../.cursor/rules/refactor-batch-strategy.mdc) — 1 PR pro Welle
- [`refactor-naming-konvention.mdc`](../../../.cursor/rules/refactor-naming-konvention.mdc) — Welle 3-III ist Plan-Welle, NICHT Future-Work-Welle
