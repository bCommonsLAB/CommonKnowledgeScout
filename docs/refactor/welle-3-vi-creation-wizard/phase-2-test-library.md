# Phase 2 — Test-Library + Modell-Absicherung

> Stand: 2026-05-31. Validiert das ADR-0003-Modell an zwei weiteren Vorlagen
> (Multi-Source-Wizard + schema-only mit Parameter-Leak) und spezifiziert die
> konsolidierte „Kitchen-Sink"-Test-Library. Baut auf
> `beispiel-zerlegung-event-creation.md` auf.
>
> **Wichtig**: Diese Zerlegungen haben **zwei Modell-Verfeinerungen** zutage
> gefördert (→ §4), die ADR-0003 aufnehmen sollte. Owner-Bestätigung nötig.

---

## 1. Zerlegung `event-finalize-de` (zweiter Wizard der Event-Familie)

**Befund**: `event-finalize` ist **kein neuer docType**. Es produziert wieder
ein „event" (Renderer `session`), aber als **Lebenszyklus-Variante**
(`eventStatus: finalDraft → finalPublished`) mit zusätzlichen **Body-Feldern**
(`bodyInText`, `EindruckDerTeilnehmer`, `Testimonials`) und System-Feldern
(`originalFileId`, `finalRunId`).

| Belang | Zuordnung |
|---|---|
| **Schema** | `event-final` **erweitert** `event` (gleicher Renderer, + Body-/Final-Felder). → **Schema-Extension**, neues Modell-Element (§4 R1) |
| **Wizard** | „Event finalisieren" — **zweiter** Wizard über die Event-Familie (`welcome → selectRelatedTestimonials → generateDraft → editDraft → previewDetail → publish`) |
| **Run-Input** | Quellen = **1 Event + N Testimonials**, zur Laufzeit geseedet (Referenzen auf existierende Dateien). Sauber — **kein** Template-Leak |

**Wichtige Punkte:**
- **Multi-Schema liegt auf der Quellen-Seite**: der Wizard mergt Event +
  Testimonials (via LLM) zu *einer* finalen Seite. Das ist **Run-Input**
  (Datei-Referenzen), kein Schema-Bezug im Output.
- **Die Event-Familie hat 2 Wizards, 1 Schema-Stamm** — bestätigt die These:
  wenige generische/familiäre Wizards über gemeinsame Schemas.
- **Fehler im Bestand sichtbar**: `editDraft.fields` listet `slug` und
  `originalFileId` — beides **System-Felder**, die **nicht** editierbar sein
  dürften. Bestätigt die System/Inhalt-Trennung (§4 R3).

---

## 2. Zerlegung `pdfanalyse-commoning` (schema-only, Renderer `book`)

| Belang | Zuordnung |
|---|---|
| **Schema** | `pdfanalyse` — ~25 Felder inkl. verschachtelter `chapters`, `toc`, `provenance`, `confidence`. Renderer `book` |
| **Extractor** | großer extraktiver `systemprompt` (Policy-Matrix, Provenienz/Confidence, Antwortschema) |
| **Schema-Config** | das **kontrollierte `topics`-Vokabular** (commons, commoning, governance, …) — siehe unten |

**Entscheidender Befund**: Der von der Inventur als „Leak" markierte Block ist
**keine Run-Daten**, sondern eine **Parameter-Liste**: das kontrollierte
Topic-Vokabular. `pdfanalyse-commoning`, `-ecosocial`, `-klima` und `pdfanalyse`
sind **dasselbe Schema + derselbe Extractor** mit **unterschiedlichem
Vokabular**.

→ Das ist eine **vierte Kategorie**: **Schema-Config / Parameter** (pro
Library/Instanz stabil, nicht pro Ausführung). Damit kollabieren **4 Vorlagen
zu 1 Schema `pdfanalyse` + 3 Config-Sets** (`topicsVocabulary`).

```
pdfanalyse (Schema + Extractor)
  ├─ config: commoning  → topicsVocabulary: [commons, commoning, governance, …]
  ├─ config: ecosocial  → topicsVocabulary: [...]
  └─ config: klima      → topicsVocabulary: [...]
```

(Alternative Lesart: drei genuin verschiedene Schemas. Verworfen, weil die
Feldmenge **identisch** ist — nur das Vokabular variiert. Parameter > Fork.)

---

## 3. Aktualisierte Kategorien (4 statt 3)

| Kategorie | Inhalt | Variiert mit | Beispiel |
|---|---|---|---|
| **Schema** | Felder + Renderer + Extractor (Stamm) | `docType` | `event`, `pdfanalyse` |
| **Schema-Config** | Parameter (Vokabular, Kanon-Listen) | Library/Instanz | `topicsVocabulary` commoning |
| **Wizard** | Flow/Steps/Quellen | generisch/Community | „Story aus Ordner", „Finalisieren" |
| **Run-Input** | Daten **einer** Ausführung | pro Erfassung | Video-Liste, Event+Testimonials-Seed |

Plus **Schema-Extension** (Vererbung): `event-final extends event`.

---

## 4. Modell-Verfeinerungen → ADR-0003 (Owner bestätigen)

- **R1 — Schema-Extension**: Schemas können erweitern (`event-final extends
  event`). Zu unterscheiden von `relatedSchemas` (Referenz, z.B. Event →
  Testimonials als Quelle). **Beide** Mechanismen nötig: *extends* (Vererbung)
  und *related* (Referenz).
- **R2 — Schema-Config/Parameter (4. Kategorie)**: parametrierbare Teile des
  Extractors/Schemas (kontrolliertes Vokabular, Kanon-Listen) sind **Config pro
  Library**, kein Template-Fork. Kollabiert massive Duplikation
  (`pdfanalyse` ×4 → ×1 + 3 Configs; analog vermutlich bei `event`-Varianten).
- **R3 — System-Felder nie als Wizard-Bindung**: `editDraft` darf nur
  Inhalts-Felder binden; System-Felder (`slug`, `docType`, `originalFileId`,
  `*WriteKey`, `finalRunId`, `eventStatus`) sind auto-gesetzt. An
  `event-finalize` als Bestandsfehler belegt.

> Diese drei Punkte ändern das Datenmodell, nicht die Grundsatz-Trennung. Sie
> sollten als Ergänzung in ADR-0003 aufgenommen werden (Status bleibt
> „Vorgeschlagen", Bindungsmodell O1 weiter offen).

---

## 5. Test-Library „Kitchen-Sink" — Spezifikation

**Ziel**: *eine* Library, die jede Mechanik **genau einmal** ausübt — der
reproduzierbare Prüfstand, der heute fehlt (0 Wizard-Tests, Testen = Library-
Hopping).

### 5.1 Inhalte (Schemas + Wizards)

| Use-Case | Schema | Wizard | übt aus |
|---|---|---|---|
| Event aus Ordner | `event` | „Story aus Ordner" | `collectSource`+`selectFolderArtifacts`+`generateDraft`+`publish`, Quellen text/url/folder, Run-Input-Migration (Video-Liste) |
| Event finalisieren | `event-final` (extends `event`) | „Finalisieren" | `selectRelatedTestimonials`, **Schema-Extension**, Multi-Source-Merge, Index-Swap |
| Testimonial (diktiert) | `testimonial` | „Testimonial erfassen" | Quelle `spoken`, kurzes Schema, **related** zu `event` |
| Dialograum-Ergebnis | `dialograum` | „Ergebnis" | `selectRelatedTestimonials`, file+text |
| PDF-Analyse (commoning) | `pdfanalyse` + Config `commoning` | — (JobWorker) | **schema-only**, **Schema-Config**, Renderer `book`, verschachtelte `chapters` |
| Steckbrief / Texture | `pc-steckbrief` (`refurbedDevice`) **oder** `Diva-Texture` (`divaTexture`) | — | **Renderer-Drift** (Wizard-Preview kennt Typ nicht) |

→ Deckt **alle 9 Presets**, **alle 5 Quelltypen**, **beide Konsumenten**
(Wizard + JobWorker), die **Renderer-Drift**, **Schema-Extension**,
**Schema-Config** und **Multi-Source-Merge** ab.

### 5.2 Inbox-/Rechte-Fälle (ADR-0004) — zwingend testbar

| Fall | erwartetes Verhalten |
|---|---|
| `contributor` erfasst Story | Submission `pending` in Inbox, **Preview sichtbar**, kein Publish |
| `owner`/`co-creator` erfasst | Co-Autor-Pfad: sofort publizierbar |
| Write-Key/QR (kontolos) | Submission ohne Login, landet in Inbox |
| Promotion bei **abgelaufenem Token** | Submission bleibt `ready`, Re-Auth-Aufforderung, Retry — **kein Absturz** |
| Promotion bei **Storage offline** | Backoff-Retry, kein halb-geschriebener Zustand |
| Reviewer lehnt ab | Submission `rejected`, kein Ziel-Schreiben |

→ Deckt **alle Inbox-Lebenszyklus-Pfade** und genau die früher instabilen
Storage-Fälle ab.

### 5.3 Charakter-Tests (Sicherheitsnetz, gegen diese Library)
- Flow-Steuerung: Step-Filter, `canProceed` je Preset, Navigation.
- Kompatibilitätsprüfung: Wizard-Feld fehlt im Schema → klarer Fehler.
- Persistenz/Inbox: Submission-Lebenszyklus, Promotion-Retry, Token-Ablauf.
- Renderer: jeder `detailViewType` der Library rendert (Preview + Galerie).

---

## 6. Nächste Schritte

1. **ADR-0003 ergänzen** um R1/R2/R3 (Owner-Bestätigung) — danach ist das
   Datenmodell vollständig.
2. **Test-Library physisch anlegen** (Phase-2-Umsetzung): die Schemas/Wizards
   aus §5.1 als konkrete Dateien/DB-Einträge + Seed-Daten für die Inbox-Fälle.
3. **Charakter-Tests** (§5.3) gegen diese Library als Sicherheitsnetz, **bevor**
   die generische Runtime (Phase 3a) gebaut wird.
4. **O1 (Feld-Bindung)** an dieser Library entscheiden — jetzt mit genug realen
   Fällen (event `$all`, finalize gemischt, schema-only ohne Wizard).
