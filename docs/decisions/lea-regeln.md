# Lea-Regeln — verbindliche Architektur- und Klassifikations-Entscheidungen

**Status:** Aktiv · **Domain:** DIVA-Texture-Pipeline · **Letztes Update:** 2026-05-29

## Was sind „Lea-Regeln"?

Verbindliche User-Entscheidungen aus der Domain-Sicht des Fachhandel-
Klassifizierers (Persona „Lea" im DIVA-Texture-Workflow). Sie haben den
Status von Architektur-Contracts: Folge-Stufen müssen sie respektieren,
Code-Kommentare verweisen explizit darauf (`Lea-Regel #N`).

**Master-Quelle:**
`.cursor/plans/diva-texture-liefersystem-integration_e7c2a98f.plan.md`,
Sektion 4 — dieses Dokument ist die navigierbare Aufschlüsselung.

**Domain-Quelle:**
`docs/diva-texture-analysen/besprechung-lea-materialien.md` —
Ursprungsbesprechung mit der Klassifiziererin Lea, aus der die Regeln
abgeleitet wurden.

## Übersicht

| # | Titel | Stand | Domäne |
|---|---|---|---|
| 1 | Ein Voll-Pass + optionaler Korrektur-Lauf | Update 1 (2026-05-28) | Pipeline |
| 2 | Liefersystem-Treffer = hohe Konfidenz | aktiv | Klassifikation |
| 3 | „Nichts erfinden" | aktiv | LLM-Prompt |
| 4 | Konfidenz pro Feld + Quelle dokumentieren | aktiv | Datenmodell |
| 5 | Liefersystem-Snapshot persistieren | aktiv | Persistenz |
| 6 | ~~Quellbild-Wahl ist manuell~~ | abgelöst durch #11 | (historisch) |
| 7 | Verifikation pro Stoffgruppe | Update 1 (2026-05-28) | UI |
| 8 | Template = flaches Preprocess, nicht Digital-Twin | aktiv | Datenmodell |
| 9 | aiGenerationHints = letzter Pass | aktiv | Pipeline |
| 10 | Galerie macht keine LLM-Calls | aktiv | Architektur |
| 11 | Pass 1 sendet beide Bilder | Update 2 (2026-05-28) | Pipeline |
| 12 | Review-Status-Lifecycle | Update 2 (2026-05-28) | Datenmodell |
| 13 | Basecolor zur Laufzeit zuschneiden | Update 2 (2026-05-28) | Pipeline |
| 14 | Crop-Größe ist 4×4 cm physisch (NICHT 360 px) | Update 3 (2026-05-29) | Pipeline |

---

## 1 · Ein Voll-Pass + optionaler Korrektur-Lauf

**Status:** Update 1 (2026-05-28) · **Ersetzt:** Zwei-Pass-Modell

Das LLM bestimmt in einem Lauf Klasse, Typ UND visuelle Properties.
Der Korrektur-Lauf (Stufe 5) läuft NUR auf Materialien, deren Klasse
nach Pass 1 vom Klassifizierer geändert wurde
(`needs_visual_refresh=true`).

**Begründung:** Das LLM konditioniert visuelle Properties intern ohnehin
auf seine eigene Klassen-Bestimmung; ein gesplitteter Pass spart keine
Inferenz-Qualität, kostet aber im Happy Path einen Extra-Call.

**Code:** `src/lib/diva-texture/material-field-sources.ts`
(`llmFieldsForPass(1)` liefert die Vereinigung Class+Type+Visuals).

---

## 2 · Liefersystem-Treffer = hohe Konfidenz für Class+Type

Kein LLM darf einen Sidecar-Treffer (`api2_GetJsonOptionValues.json`)
in `material_class` überschreiben.

**Code-Beispiel:** `src/lib/diva-texture/first-pass.ts:99-114` —
Sidecar-Hit setzt deterministisch `confidence_class = 0.95`, LLM-Antwort
wird verworfen.

---

## 3 · „Nichts erfinden"

Wenn Information weder im Bild noch im LIEFERSYSTEM-Block steht, darf
sie nicht im Output stehen (Feld leer lassen / `null`).

**Code:** System-Prompt in `template-samples/Diva-Texture-Analysis.md`
(„Strenge Regeln" Sektion).

---

## 4 · Konfidenz pro Feld + Quelle dokumentieren

Jedes Frontmatter-Feld muss eine deklarierte Herkunft haben:
`divadata` (Liefersystem) · `ai_pass1` (Klasse/Typ) · `ai_pass2`
(visuelle Properties) · `ai_last_pass` (Hints) · `path` (deterministisch
aus Pfad/Sidecar).

**Code:** `src/lib/diva-texture/material-field-sources.ts` —
maschinenlesbare Fassung von Leas Farb-Legende, einziger Ort, an dem
neue Felder ihre Herkunft deklarieren müssen.

---

## 5 · Liefersystem-Snapshot am Material persistieren

Sonst kann ein späterer Korrektur-Lauf (Stufe 5) oder eine Re-Analyse
nicht mehr auf die Stammdaten zugreifen. Beispiel: „Eiche geölt" steht
nur in den Sidecar-Stammdaten, nicht im Bild.

**Geplant für Stufe 6:** Frontmatter-Feld `lieferSystemSnapshot:
{ fetchedAt, sourceFile, sourceFileHash, entry }`. Aktuell noch nicht
umgesetzt.

---

## 6 · ~~Quellbild-Wahl ist manuell~~ → abgelöst durch #11

**Historischer Stand bis 2026-05-28:** Klassifizierer wählte je Textur,
ob das LLM den Basecolor oder das Liefersystem-Preview analysieren
sollte. Die Wahl wurde im Archiv-Property-Store unter VCodex
persistiert (`analysisSourceImage`).

**Heute:** Pipeline ignoriert die Wahl, das Toggle in der UI bleibt nur
als Anzeige-Präferenz (welches Bild im Vorschau-Slot prominent).
Update 3 (2026-05-29): das UI-Toggle wurde komplett entfernt
(Lea-Regel #11 macht es überflüssig).

---

## 7 · Verifikation pro Stoffgruppe statt pro Muster

Spart Klick-Aufwand bei größeren Lieferungen. Stoffgruppen-Klassifikation
(Stufe 4) zeigt einen Repräsentanten je Gruppe und propagiert die
bestätigte Klasse auf alle Mitglieder.

**Hinweis 2026-05-28:** Spart KEINE LLM-Calls mehr (jedes Material
läuft eigenständig in Phase C), sondern macht nur die Sichtung +
Klassen-Bestätigung effizienter.

**Geplant für Stufe 4** (`feature/diva-texture-group-classification`).

---

## 8 · Template = flaches Preprocess, NICHT das Digital-Twin

Das Frontmatter ist flach + Obsidian-kompatibel (snake_case, eine
Ebene, keine Dot-Notation, keine verschachtelten Objekte). Es liefert
nur die KI-Kernfelder + den `diva-`Liefer-Block. Leas verschachteltes
Material-Digital-Twin ist ein SPÄTERES MongoDB-Objekt, das downstream
aus den flachen Feldern + Cache-/Bitmap-Daten zusammengesetzt wird.

**Verbindlich projektweit:** `AGENTS.md` Abschnitt „Frontmatter-Format".

**Anti-Pattern:** verschachtelte Dot-Notation-Keys im Frontmatter
(`material.class: fabric`) oder nested YAML-Objects. → `pnpm lint`
würde solche Templates erkennen (Test `diva-texture-template.test.ts`).

---

## 9 · aiGenerationHints = letzter Pass

`ai_prompt_positive` / `ai_prompt_negative` / `ai_realism_notes` werden
in jedem Lauf neu erzeugt. Auf welchen Pass sie sich beziehen, hält
das Pipeline-Feld `last_pass` fest.

Konfidenzen werden in einem Voll-Pass alle gemeinsam vom LLM bestimmt
(`confidence_class` / `confidence_type` / `confidence_visual`); im
Korrektur-Lauf (Stufe 5) wird nur `confidence_visual` erneuert, die
beiden anderen bleiben durch die user-bestätigten Werte fixiert.

Pass-Status: `pass1_status` nach Phase C, `pass2_status` nach
Korrektur-Lauf.

---

## 10 · Galerie macht keine LLM-Calls

**Status:** aktiv · **Eingeführt:** 2026-05-27 (User-Entscheid)

Jeder LLM-Aufruf läuft über die `/api/external/jobs`-Pipeline
(Archiv-Trigger). Korrekturen in der Galerie schreiben
Frontmatter-Patches direkt ins Shadow-Twin-Artefakt, damit ein späterer
Korrektur-Lauf sie als CONTEXT sieht.

**Architektur-Regel:** KEIN paralleler LLM-Pfad außerhalb der
Jobs-Pipeline.

**Code-Beispiele:**
- `src/app/api/diva-texture/material-classification/route.ts:14` —
  Korrektur in Galerie patcht nur Frontmatter, kein LLM-Call.
- `src/app/api/diva-texture/group-classify/route.ts:13` — gleicher
  Pattern für Bulk-Apply.

---

## 11 · Pass 1 sendet beide Bilder

**Status:** Update 2 (2026-05-28) · **Löst ab:** #6

Der Pipeline-Lauf bekommt sowohl den Basecolor-Ausschnitt (zur Laufzeit
aus dem Original gerechnet, siehe #13) als auch — falls verfügbar — das
Liefersystem-Preview-Bild als zweiten Image-Input.

Zusatzfrage ans LLM: passt der Farbton der beiden Bilder zusammen
(`color_match_supplier`)? Bei `false` wird `review_status` automatisch
auf `zu_ueberarbeiten` gesetzt (siehe #12), das LLM liefert eine
Pflicht-Begründung in `color_match_notes`.

**Begründung:** Bugs erkennen, bei denen Preview und Basecolor
unterschiedliche Materialien oder Farbvarianten zeigen.

**Code:**
- `src/lib/diva-texture/first-pass-runner.ts:14` — Pipeline ignoriert
  `analysisSourceImage`-Wahl.
- `src/components/library/file-preview/views/diva-supplier-data-view.tsx:13` —
  UI-Toggle entfernt (Update 3).

---

## 12 · Review-Status-Lifecycle

**Status:** Update 2 (2026-05-28)

Jedes Material hat ein Statusfeld `review_status` mit den Werten:

```
nicht_geprueft  (initial, vor Pass 1)
   ↓
ki_geprueft     (Pass 1 ohne Farb-Mismatch)
   ↓
zu_ueberarbeiten (Farb-Mismatch ODER manuell gesetzt)
   ↓
abgenommen      (User-Bestätigung)
```

**Override-Schutz:** `abgenommen` und manuell gesetztes
`zu_ueberarbeiten` werden vom Pass-1-Lauf NICHT überschrieben. Nur
`nicht_geprueft` und `ki_geprueft` dürfen vom Pass-1-Postprocessor
überschrieben werden.

**Status ist materialweit, nicht gruppenweit** — die Gruppen-Propagation
aus Stufe 4 ändert `review_status` nicht.

**Code:**
- `src/lib/diva-texture/review-status.ts:20` — Lifecycle-Definition.
- `src/lib/diva-texture/read-existing-review-status.ts:4` —
  Override-Schutz-Lookup.
- `src/lib/diva-texture/material-field-sources.ts:39` — Quellen-Map-
  Eintrag (Quelle `pipeline_lifecycle` bzw. `manual`).

---

## 13 · Basecolor zur Laufzeit zuschneiden

**Status:** Update 2 (2026-05-28) · **Verfeinert durch #14** (Update 3)

Basecolor-Texturen sind oft 4 K oder größer — fürs LLM ist das
verschwenderisch und in der Detail-Sicht zu grob. Vor jedem LLM-Call
rechnet `basecolor-crop.ts` ZUR LAUFZEIT einen Center-Crop und berechnet
die echte cm-Größe des Ausschnitts über DPI aus dem Datei-Header
(`sharp` / `extractImageMetadata`).

Der cm-Wert wird als `basecolor_crop_cm` in den CONTEXT-Block
geschrieben, damit das LLM die physikalische Skala kennt.

**Keine Persistenz** des Crops — gibt es eh keinen Ort dafür, und der
Crop ist deterministisch reproduzierbar.

**Code:** `src/lib/diva-texture/basecolor-crop.ts`.

---

## 14 · Crop-Größe ist 4×4 cm physisch (NICHT Pixel-Größe)

**Status:** Update 3 (2026-05-29) · **Verfeinert:** #13

Frühe Variante (Update 2): fixe 360×360-px-Kante. Problem: die cm-Größe
des Ausschnitts hing dann von der Source-DPI ab (3 cm bei 300 DPI, 1,5
cm bei 600 DPI, 12,7 cm bei 72 DPI). Folge: das LLM bekam für ähnliche
Materialien je nach Datei-DPI unterschiedliche „Sichten" → `pattern_scale`
(`fine` / `small` / `medium` / `large`) wurde nicht stabil bewertet.

**Heute:** fixe 4×4 cm physisch. Die Pixel-Kante wird aus der Source-DPI
abgeleitet (`round(4 cm × dpi / 2.54)`), gekappt auf max. 512 px:

- Source < ~128 DPI effektiv: Pixel-Kante < 512, native ausgegeben
  (kein Upsample — würde nur Tokens kosten ohne Mehrinfo).
- Source ≥ ~128 DPI effektiv: Crop in Source-DPI extrahieren, dann
  via `sharp.resize` auf 512×512 herunterrechnen.
- Source < 4 cm in einer Dimension: Voll-Bild senden (Edge-Case #20),
  ggf. proportional auf max. 512 px gekappt.

**Begründung:** Das LLM sieht jetzt für jede Textur denselben physischen
Materialausschnitt → `pattern_scale` robust unabhängig von der Source-DPI.
Token-Verbrauch ist gleichzeitig optimiert (Cord-Rippen/Bouclé-Schlaufen
sind bei 128 effektiven DPI klar erkennbar).

**Code:** `src/lib/diva-texture/basecolor-crop.ts` (Konstanten
`PHYSICAL_CROP_CM = 4`, `MAX_OUTPUT_PX = 512`, `FALLBACK_DPI = 300`).

**Validierung Bulk-Lauf 230 Texturen:** `basecolor_crop_cm: "4.0x4.0"`
konstant, `basecolor_crop_px` variiert 113–512.

---

## Wie neue Lea-Regeln entstehen

1. User-Entscheid wird im Plan-File festgehalten
   (`.cursor/plans/diva-texture-liefersystem-integration_e7c2a98f.plan.md`,
   Sektion 4 + Änderungs-Log).
2. Nächstfolgende Nummer wird vergeben, **alte Regeln bleiben in der
   Liste** (auch wenn abgelöst — als historischer Anker für Code-Kommentare).
3. Dieses Dokument wird ergänzt: neuer Eintrag + Tabellenzeile + ggf.
   Cross-Reference zu anderen Regeln.
4. Code-Stellen, die die neue Regel zitieren, verwenden den Marker
   `Lea-Regel #N` in JSDoc-Kommentaren — so bleibt die Verbindung
   auch beim Grep auffindbar.
