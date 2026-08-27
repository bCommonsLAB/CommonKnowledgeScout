# Contracts: Welle 3-III — Galerie + Story-Mode + Chat

Stand: 2026-05-02. Quelle: [`../../contracts/welle-3-iii-galerie-chat-contracts.md`](../../contracts/welle-3-iii-galerie-chat-contracts.md).

## Verweis auf die neue Rule

Die harten Invarianten fuer diese Welle stehen in der Rule-Datei
[`welle-3-iii-galerie-chat-contracts.mdc`](../../contracts/welle-3-iii-galerie-chat-contracts.md).

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

- [`storage-abstraction.mdc`](../../contracts/storage-abstraction.md) — Welle haelt sich daran (0 Verstoesse)
- [`no-silent-fallbacks.mdc`](../../contracts/no-silent-fallbacks.md) — Welle haelt sich daran (0 Verstoesse)
- [`media-lifecycle.mdc`](../../contracts/media-lifecycle.md) — Galerie ist Read-Only-Konsument von Frontmatter
- [`chat-contracts.mdc`](../../contracts/chat-contracts.md) — Backend-Contracts; UI ist Konsument
- [`shadow-twin-architecture.mdc`](../../contracts/shadow-twin-architecture.md) — gallery-root und chat-panel lesen Shadow-Twin-State
- [`prio1-state-caching-navigation.mdc`](../../plans/archiv/prio1-state-caching-navigation.md) — URL-State-Verträge
- [`refactor-batch-strategy.mdc`](../../contracts/refactor-batch-strategy.md) — 1 PR pro Welle
- [`refactor-naming-konvention.mdc`](../../contracts/refactor-naming-konvention.md) — Welle 3-III ist Plan-Welle, NICHT Future-Work-Welle
