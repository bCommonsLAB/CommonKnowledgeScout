# Veraltete Logik, Defekte, Risiken (mit Code-Beleg)

Befunde der Code-Inventur 2026-06-11. Gruppiert nach Handlungstyp.

## A — Toter Code, sofort löschbar (Welle 3-IV-UX-0, risikofrei)

| # | Befund | Beleg |
|---|---|---|
| A1 | Shadcn-Template-Reste ohne Persistenz (speichern nur einen Toast): `owner-form`, `notifications-form`, `display-form`, `appearance-form` + Routen `/settings/owner`, `/notifications`, `/display`, `/appearance` | nirgends verlinkt (`layout.tsx` `allSidebarItems`); kein API-Call in den Forms |
| A2 | Routen-Duplikat `/settings/library` (rendert `LibraryForm` wie `/settings`) | `src/app/settings/library/page.tsx`; kein `href` darauf in `src/` |
| A3 | Totes Index-Status-Panel: `healthResult`/`healthError` werden nie gesetzt → Panel kann nie erscheinen | `use-chat-form.ts:218-219` (useState ohne Setter), `chat/chat-form.tsx:227-256` |
| A4 | Toter Hook-State `isUpgradingShadowTwinMode` (Section verwaltet eigenen State) | `library/hooks/use-library-form.ts` |
| A5 | Debug-Logs ohne Guard in Produktion | `use-chat-form.ts` (`===== LIBRARY LADEN START =====`, `✅ onSubmit wurde aufgerufen!`) |

## B — Scheinkontrollen / wirkungslose Felder (User-Entscheidung, dann entfernen oder fertigbauen)

| # | Befund | Beleg | Entscheidung |
|---|---|---|---|
| B1 | `transcription`-Select („Shadow Twin" vs. „In Datenbank") wird nirgends als Bedingung ausgewertet — Scheinkontrolle | nur Durchreichung in `library-service.ts`, `export/route.ts` | **E4: streichen** |
| B2 | `config.templateDirectory` wird nie gelesen | nur Settings + `create-library-dialog.tsx` | **E4: streichen** |
| B3 | `config.description` wird nirgends angezeigt | nur Formular + Export | **E4: streichen**, ggf. in usSpace-Beschreibung aufgehen |
| B4 | Google Drive ist Attrappe: Felder speichern, aber kein Provider, keine OAuth-Route, kein Factory-Zweig | `storage/gdrive-section.tsx`; kein `gdrive-provider.ts` in `src/lib/storage/` | **F4 entschieden: entfernen** |
| B5 | ~~`chatLlmModel` ohne Downstream-Leser~~ — **Verifikation 2026-06-11: Verdacht widerlegt.** `config.chat.models.chat` wird von den Chat-API-Routen gelesen (`api/chat/[libraryId]/route.ts:244,332`, `adhoc/route.ts:44`) als Fallback ohne Modell-Parameter | — | kein Handlungsbedarf; Feld bleibt (per F8 unter „Erweitert") |
| B6 | Galerie-Texte halbfertig: `galleryHeadline/Subtitle/Description/FilterDescription` im Zod-Schema + Defaults (SFSCon-Hardcodes!), aber kein FormField, fehlt im PUT-Body; API-Merge + Galerie-Leser existieren | `public/public-form.tsx:66-69,120-143,211-222`; `api/libraries/[id]/public/route.ts:152-157`; `lib/gallery/api.ts` | **E2: fertig bauen** (usSpace) |
| B7 | `testimonial`/`blog` im Schema, nicht im Dropdown — Vertiefung 2026-06-11: KEIN Defekt, sondern halbfertiges Feature. Dokument-Ebene aktiv (Wizard, Templates, Testimonial-API); Galerie-/Story-Ansichten fehlen (TODOs in `story-view.tsx:133-147`) | `use-chat-form.ts:300` vs. `gallery-config-section.tsx:87-93` | **E5 revidiert: NICHT reaktivieren** — Testimonial-Integration als Produkt-TODO T1 (README §8); Schema bleibt |

## C — Strukturelle Altlasten (im Raum-Umbau beheben)

| # | Befund | Beleg |
|---|---|---|
| C1 | ~~Shadow-Twin-Legacy-„Modus" als Formularfeld~~ — **ERLEDIGT 2026-06-12**: Modus-Block und Primary-Store-Dropdown entfernt (v2/Cache sind fixiert, Speichern normalisiert Alt-Configs); Bestands-Libraries mit legacy-Flag sehen nur noch einen Upgrade-Banner; neue Libraries starten mit v2/Cache statt legacy (`create-library-dialog`) | `shadow-twin-config-section.tsx`, `use-library-form.ts` |
| C2 | `targetLanguage` doppelt: `secretaryService.targetLanguage` mit Fallback `chat.targetLanguage` | `secretary-service-form.tsx:86-90` |
| C3 | `SearchIndexDialog`/`IndexDefinitionDialog` liegen top-level, werden nur von `chat/chat-form.tsx` genutzt | Imports `chat-form.tsx:27-28` |
| C4 | Binary-Storage/Azure-Sektion im „Story"-Tab — Storage-Thema im Chat-Formular (vgl. `storage-abstraction.mdc`) | `chat/binary-storage-section.tsx` |
| C5 | Begriffschaos: Tab „Transformation" = intern „Secretary Service"; Tab „Story" = Chat + Galerie + Graph + Azure | `layout.tsx` vs. Komponenten |
| C6 | Sprach-Bereinigung: 5 Sprachen hartcodiert statt aus Bestand ermittelt | `language-cleanup-section.tsx` |
| C7 | Storage-Test filtert Server-Step `"API-Aufruf"` aktiv aus der Anzeige | `storage-form.tsx` (`result.step !== "API-Aufruf"`) |

## D — Risiken / Gefahren-UX (Paket in Welle 3-IV-UX-3)

| # | Befund | Beleg |
|---|---|---|
| D1 | Speichertyp-Wechsel bestehender Library ohne Warnung/Migrationshinweis — gravierendste stille Gefahr | `storage-form.tsx` → `PATCH /api/libraries/{id}` |
| D2 | „Von OneDrive abmelden" kappt Zugriff sofort, ohne Bestätigung | `use-storage-form.ts` (`DELETE …/tokens`) |
| D3 | 4× `window.confirm()` statt Design-System-Dialog: Migration laden, Sprach-Artefakte löschen, Mitglied entfernen, Anfrage entfernen | `use-shadow-twin-migration.ts`, `language-cleanup-section.tsx`, `use-members-actions.ts`, `use-access-requests-actions.ts` |
| D4 | ~~Entzieht Löschen einer genehmigten Anfrage den Zugriff?~~ — **GEPRÜFT + GEFIXT 2026-06-12**: Zugriffsprüfungen lesen live aus `library_access_requests` (kein zweiter Persistenzort); einziges Leck war der 10s-In-Memory-Cache des access-check — jetzt ausgelagert (`lib/library-access/access-check-cache.ts`) und bei Statusänderung/Löschung invalidiert | erledigt |
| D5 | ~~`secretaryService.apiKey` unmaskiert~~ — **GEFIXT 2026-06-12**: apiKey UND Azure-`connectionString` werden in `toClientLibraries` maskiert; `preserveMaskedSecrets()` in `updateLibrary` schützt alle 5 Secret-Pfade vor Masken-Überschreibung (6 Char-Tests); Klartext-Logging entfernt | erledigt |
| D6 | Dateisystem-Export und JSON-Import ohne Bestätigung | `import-export-section.tsx` |
| D7 | OneDrive-Token-Status nur aus `localStorage`, kein Server-Check; bei Ablauf kein geführtes Re-Auth | `use-storage-form.ts`, `storage-context.tsx` |

## Empfohlene Reihenfolge

**Stand 2026-06-11: A1–A5, B1–B4 UMGESETZT** (Welle 3-IV-UX-0, Commits
`18919d6`, `56574df`, `916886e`, `e92a630`; 1674 Tests grün, Lint sauber).
B5 verifiziert (kein Handlungsbedarf). Offen aus diesem Dokument: B6
(usSpace-Welle), C komplett (Raum-Umbau), D komplett (Gefahren-UX-Paket).

1. ~~**A komplett** — eigenständige Cleanup-PR~~ erledigt
2. ~~**B1–B4**~~ erledigt; B6 fertigbauen in usSpace (E2); B7 unverändert lassen (E5 revidiert — Produkt-TODO T1 statt Settings-Änderung)
3. **C im Zuge des Raum-Umbaus** (Welle 3-IV-UX-2/3) — Verschieben + Umbenennen
4. **D als Gefahren-UX-Paket** — einheitliches Bestätigungs-Muster (Vorbild: Lösch-Dialog der Library), D4/D5 vorab prüfen
