# Welle 3-VI Creation-Wizard — Bekannte Alt-Bugs (vor/parallel zum Refactor)

> Charakterisierungs-/Smoke-Tests decken bestehende Fehler auf. Regel
> (`00-refactor-plan.md` §6, AGENTS.md): **dokumentieren, NICHT im Refactor-Commit
> fixen** — die Fixes gehören in die zuständige Sub-Welle.

## KI-1 — Speichern/Publizieren bricht ab: „savedItemId fehlt" (Storage-/Shadow-Twin-Race)

- **Gefunden:** 2026-06-15 beim manuellen U1-Smoke-Test
  (`event-creation-de`, Folder-Flow `sourceFolderId`), Schritt „Fertigstellen".
- **Symptom (UI):** „Publizieren wird gestartet… Speichern fehlgeschlagen
  (savedItemId fehlt)." — Wizard bleibt hängen.
- **Server-Log:** Datei-Upload `200` → unmittelbar danach
  `StorageFactory: Lösche Provider … aus dem Cache` → `GET …action=get 404`
  („Failed to get item", `storage-factory.ts:213`) → `shadow-twins/upsert 500`.
- **Ursache (Hypothese):** Der StorageProvider-Cache wird **mitten im Speichern**
  invalidiert; die gerade hochgeladene Datei ist danach nicht mehr lesbar →
  Folge-Lookup `404` → `handleSave` liefert keine `savedItemId` →
  Publish-Schritt (`creation-wizard.tsx`, generic onPublish) wirft
  „Speichern fehlgeschlagen (savedItemId fehlt)".
- **Kein U1-Regress:** `git diff` belegt, dass `handleSave`/`onPublish`/
  Shadow-Twin-Pfad durch die U1-Migration **unverändert** sind → Bug tritt auch
  auf `master` auf.
- **Zuständige Sub-Welle:** **U4 / 3-VI-e** („Persistenz vereinheitlichen": EIN
  atomarer Submission-Commit statt 3 konkurrierender Speicherpfade + Shadow-Twin-
  Upsert). Bis dahin: offener Alt-Bug.
