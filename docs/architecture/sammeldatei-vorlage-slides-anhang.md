# Sammeldatei, Vorlage, Slides und Anhang — wie sie zusammenspielen

> Stand 2026-10-06 (P6 des Plans „Von Menschen geprüfte Veranstaltung").
> Gilt für Vortrags-Sammeldateien wie in der Event-Library vom 05.10.2026
> (PR #348), ist aber nicht auf Vorträge beschränkt.

## Die vier Bausteine

| Baustein | Was es ist | Wo es liegt |
|---|---|---|
| **Sammeldatei** | Ein Markdown im Storage mit `_source_files` (Quellen, z. B. Audio + Folien-PDF + Flyer) und `_media_files` (Bilder, Anhänge). Enthält selbst fast keinen Text; sie *verweist*. | `src/lib/creation/composite-transcript.ts` (`buildCompositeReference`, `resolveCompositeTranscript`), `composite-source-files-meta.ts`, `composite-media-files.ts` |
| **Vorlage** | Template mit Frontmatter-Feldern (`{{feld\|Anweisung}}`) und Body-Blöcken; der Secretary baut daraus das Antwortschema. Beispiel `template-samples/vortrag-session-de.md` mit Feld `slides`. | MongoDB (`TemplateDocument`), Wire-Format siehe `docs/architecture/template-system.md` |
| **Slides** | Frontmatter-Feld `slides`: ein Objekt je Folienseite (`page_num`, `title`, `summary`, `image_url`). Die Anzeige rendert daraus das Folien-Akkordeon; `image_url` wird über die Binärfragmente des Twins aufgelöst. | `src/components/library/slide-accordion.tsx`, `event-slides.tsx`, `src/lib/ingestion/slide-image-resolver.ts` |
| **Anhang** | Unsichtbarer Abschnitt, den NUR der Ingest an den eingebetteten Text hängt: je verbundener Quelle ein Kapitel `## Anhang N: <Datei> (Transkript)`. Die Anzeige (`docMetaJson.markdown`) bleibt der Body der Vorlage. | `src/lib/external-jobs/ingest-source-appendix.ts`, Chunk-Kennzeichnung `src/lib/ingestion/source-appendix-chunks.ts` |

## Der Weg durch die drei Phasen

```
Phase 1 EXTRACT      je Quelle ein Transkript (Audio → Text, PDF → Text mit Seitenmarkern + Seitenbildern)
                     Die Sammeldatei selbst hat keinen Extract-Schritt (Markdown).

Phase 2 TRANSFORM    resolveCompositeTranscript(): Wiki-Links der Sammeldatei auflösen,
                     Transkripte der Quellen aus MongoDB laden, „Verfügbare Medien“ anhängen
                     → EIN geflachter Text als LLM-Eingabe (nie persistiert)
                     Vorlage (ggf. ohne `slides`, s. u.) → Secretary transform-by-template
                     → Transformation mit Frontmatter (Facetten, Cover, attachments_url, slides) + Body

Phase 3 INGEST       Transformation laden; Anhang bauen (wenn aktiv) aus den Transkripten
                     der `_source_files`; Text = Body + Anhang → Embeddings; Chunks im Anhang
                     tragen `sourceType: 'anhang'` samt Nummer und Quelle (Quellenangabe im Chat).
```

Zwei Dinge verwechselt man leicht:

- **Slides sind Ergebnis der Vorlage** (Phase 2). Ohne Feld `slides` in der
  Vorlage gibt es kein Akkordeon, egal wie viele Folien im PDF sind.
- **Der Anhang ist Ergebnis des Ingests** (Phase 3). Er verändert weder die
  Transformation noch die Anzeige; er verändert nur, was die Suche findet und
  wie groß der Index wird.

## Die zwei Optionen im Dialog „Aufbereiten & Publizieren“ (P6)

| Option | Sichtbar | Wirkung | Wo sie ankommt |
|---|---|---|---|
| **Slides als Tabelle führen** | nur bei Vorlagen mit Feld `slides` (Prüfung `templateHasFrontmatterField`, Hook `use-template-has-field.ts`) | ohne Haken wird das Feld `slides` **für diesen Lauf** aus dem Frontmatter der Vorlage genommen (`removeTemplateFrontmatterField`); die Vorlage in MongoDB bleibt | `parameters.slidesAsTable` → `phase-template.ts` (`applySlidesOption`), Trace `template_slides_option` |
| **Anhänge als Text in die Suche** | immer bei aktivem Schritt „Story publizieren“ | an: Anhang wird gebaut; aus: nur der Body der Vorlage wird eingebettet | `parameters.appendixInSearch` → `phase-ingest.ts` (`resolveAppendixDecision`), Trace `ingest_anhang_entscheidung` |

**Kein stiller Default.** Beide Werte werden nur als explizite Booleans
durchgereicht (`pipeline-config.ts`, `/api/pipeline/process`). Fehlt der Wert
(Batch, MCP `quelle_erschliessen`, ältere Clients):

- Slides: Vorlage unverändert (Trace `slidesAsTable: nicht gesetzt`).
- Anhang: Library-Voreinstellung `ingestSourceAppendix` (Einstellungen →
  Erweitert, mit Hinweis auf die Indexgröße), sonst Standard **an**
  (Owner-Entscheidung 05.10.2026). Die entscheidende Ebene steht im Trace
  (`quelle: lauf | library | standard`).

## Warum der Anhang eine Option braucht

Prüffall Teil 2 der Journalistenschulung: **17 Chunks ohne, 239 Chunks mit
Anhang**. Der Anhang macht Details der Diskussion und der Folien im Chat
auffindbar, kostet aber Embeddings, Speicher und Antwortzeit. Für eine
Library mit vielen kurzen Dokumenten ist „aus“ die richtige Voreinstellung;
für eine Event-Library mit wenigen tiefen Dokumenten „an“.

## Warum Slides eine Option brauchen

Das Feld `slides` zwingt das Modell zu einem Objekt je Folienseite; bei 50
und mehr Folien wird die Antwort lang und teuer, und bei Quellen ohne Folien
ist das Feld nur Ballast. Statt eine zweite Vorlage zu pflegen, nimmt der
Lauf das Feld heraus.

## Verwandt

- `docs/architecture/pipeline-phases.md` — die drei Phasen, Policies, Routen
- `docs/architecture/template-system.md` — Frontmatter-Field-Mechanik der Vorlagen
- `docs/contracts/media-lifecycle.md` — Medien-Vertrag (`_media_files`, Binärfragmente)
- `docs/contracts/ingestion-contracts.md` — Determinismus, fehlende Quelle = Fehler
