# Creation-Wizard: UX-Anforderungen (vor dem Refactor)

> **Status: ABGENOMMEN — 2026-06-14 (Repo-Owner).**
>
> Dieser Pfad ist im Strategie-Plan (`welle-3vi-creation-wizard-ux-first`)
> festgelegt: Die UX-Beduerfnisse werden **vor** dem Refactor dokumentiert und
> abgenommen, damit der Refactor die finale UX einfriert. Mit dieser Abnahme ist
> das Phase-0-Gate aus
> `docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md` (§0/§6) **erfuellt**
> — die Sub-Wellen 3-VI-b…f (bzw. U1…) duerfen starten.
>
> Skelett-Grundlage: Schwachstellen-Analyse
> (`docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`, §2).

## Leitbild

> Der Wizard soll einem **einfachen Anwender** ermoeglichen, eine Story oder
> Daten zu erfassen — ohne technisches Vorwissen, mit verlaesslichem Feedback
> und einem klaren Standardweg.

## Abgenommene UX-Entscheidungen

### A. Standardpfad ("ein Klick -> fertig")

- **A1 — Express-Standardpfad.** Der kuerzeste sinnvolle Weg ist der Default:
  Quelle -> (verarbeiten) -> kurz pruefen -> fertig. Kern-/Pflichtschritte sind
  sichtbar; **optionale** Schritte (Bilder, verwandte Beitraege, Feinjustierung)
  sind **eingeklappt** und haben einen klaren **"Ueberspringen"**. Pro Schema
  wird festgelegt, welche Schritte optional sind. (Profi verliert nichts —
  Optionales ist nur eingeklappt, nicht weg.)
- **A2 — Bestaetigungen nur bei Maschinen-Ergebnis.** `hasConfirmedSources`
  entfaellt im Standardfall (Quellen sind sichtbar). `hasConfirmedMarkdown`
  bleibt **nur** bei maschinell erzeugtem Inhalt (PDF-OCR, Audio-Transkription,
  LLM-Entwurf); bei selbst getipptem Text **kein** Bestaetigungs-Haekchen.

### B. Orientierung & Fortschritt

- **B1 — Schrittliste einmal festgelegt, dann stabil.** Sobald die Erfassungsart
  feststeht, berechnet der Wizard die Schrittliste fuer **diesen** Lauf **einmal**
  und aendert sie danach **nicht mehr** (kein Auftauchen/Verschwinden mitten im
  Ablauf). Optionale Schritte bleiben sichtbar, als **"(optional)"** markiert und
  ueberspringbar.
- **B2 — Feste Default-Labels + optionaler Override.** Jedes Preset hat einen
  festen, menschenlesbaren Standard-Titel in der Engine (nie der technische
  Preset-Name). Der Template-Autor **darf** pro Schritt via `step.title`
  ueberschreiben — Pflicht ist es nicht.
- **B3 — Blockierender "Bitte warten…"-Hinweis.** Langlaufende Operationen
  (OCR/Transkription/LLM) werden mit einem blockierenden Wartehinweis angezeigt.
  *(Nicht Teil der Abnahme, optionaler spaeterer Ausbau: Phasen-Klartext und/oder
  Abbrechen — kann ergaenzt werden, ohne diese Entscheidung umzuwerfen.)*

### C. Feedback & Fehler

- **C1 — Ein zentrales Status-/Fehler-Element.** Alles, worauf man reagieren muss,
  erscheint **immer an derselben Stelle** oben im aktuellen Schritt
  (farbcodiert: rot = Fehler, gelb = Hinweis, gruen = erledigt). Toast nur noch
  fuer kurze Erfolgsmeldungen. Kein gemischtes Toast/Inline/Alert mehr.
- **C2 — Grund fuer deaktiviertes "Weiter" sichtbar.** Solange "Weiter" grau ist,
  steht als Klartext sichtbar, **was fehlt** (kann im Status-Element aus C1 liegen).
- **C3 — Kaputte Vorlage: freundlich, frueh, mit Ausweg.** Unvollstaendige/kaputte
  Vorlagen werden **moeglichst frueh** (Kompatibilitaetspruefung beim Start,
  ADR-0003) erkannt und mit einer verstaendlichen Meldung + Ausweg ("Andere
  Vorlage waehlen"/"Zurueck") angezeigt; der technische Grund steckt in einem
  aufklappbaren **"Details"**. Kein leerer Schritt, kein Silent-Fallback.

### D. "Weiter"-Verhalten

- **D1 — Vorwarnung nur bei langlaufend/unumkehrbar.** Vor gewichtigen Aktionen
  (Verarbeitung starten, Veroeffentlichen) erscheint eine kurze Vorschau/Erklaerung,
  was gleich passiert. Harmlose Navigationsschritte bleiben schlicht "Weiter".
- **D2 — Ein klar benannter Hauptknopf je Schritt.** Pro Schritt **ein**
  Primaerknopf, benannt nach seiner echten Aktion ("Weiter"/"Verarbeiten"/
  "Speichern"/"Veroeffentlichen"/"Fertig"). Keine mehreren konkurrierenden
  Aktionsknoepfe.

### E. Inhaltliche Erklaerung

- **E1 — Schema-/story-spezifischer Welcome (mit Fallback).** Der Start-Schritt
  erklaert knapp und konkret, was bei *dieser* Erfassung passiert
  (`creation.welcome.markdown`); fehlt der Text, greift ein generischer Standard.
  Bewusst kurz halten, damit der Express-Pfad (A1) schlank bleibt.
- **E2 — Pflicht-/Inhaltsfelder immer sichtbar, Leere markiert.** Die
  Inhaltsfelder des Schemas werden **immer** angezeigt; leere **Pflichtfelder**
  sind klar markiert ("Pflichtfeld – bitte ausfuellen"). System-/Strukturfelder
  bleiben aussen vor (O1: nur `kind=content`). Kein stilles Verschwinden.

### F. Template-Verwaltung (separat, niedrigere Prio)

- **F1 — Visueller Template-Builder zurueckgestellt.** Nicht Teil dieses Umbaus;
  spaetere Stufe (ADR-0003 Phase 4 / "U8"), erst nach stabiler Wizard-Laufzeit.
  Autoren bleiben bis dahin beim Markdown/JSON-Editor.

## Abnahme

| Punkt | Entscheidung | Datum |
|---|---|---|
| A1 | Express-Standardpfad (Optionales eingeklappt + "Ueberspringen") | 2026-06-14 |
| A2 | Bestaetigung nur bei Maschinen-Ergebnis | 2026-06-14 |
| B1 | Schrittliste einmal festgelegt, dann stabil | 2026-06-14 |
| B2 | Feste Default-Labels + optionaler Autor-Override | 2026-06-14 |
| B3 | Blockierender Wartehinweis (Phasen-Text/Abbruch optional spaeter) | 2026-06-14 |
| C1 | Ein zentrales Status-/Fehler-Element oben im Schritt | 2026-06-14 |
| C2 | Grund fuer deaktiviertes "Weiter" sichtbar | 2026-06-14 |
| C3 | Kaputte Vorlage: freundlich + frueh + Ausweg + Details-Aufklapper | 2026-06-14 |
| D1 | Vorwarnung nur bei langlaufend/unumkehrbar | 2026-06-14 |
| D2 | Ein klar benannter Hauptknopf je Schritt | 2026-06-14 |
| E1 | Schema-/story-spezifischer Welcome mit Fallback | 2026-06-14 |
| E2 | Inhalts-/Pflichtfelder immer sichtbar, Leere markiert | 2026-06-14 |
| F1 | Visueller Template-Builder zurueckgestellt (U8) | 2026-06-14 |

Mit dieser Abnahme starten die Sub-Wellen 3-VI-b…f
(`docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md`) bzw. die
Arbeitspakete U1…U8 (`docs/wizards/umbauplan-generischer-erfassungs-wizard.md`).

## Nachtrag 2026-06-15 — editDraft-Feld-Layout (abgenommen)

Beim U3-Smoke-Test entschieden (Owner): Die Felder im Bearbeiten-Schritt waren
zu „rahmenlastig". Neues, kompaktes Layout:

- **Label links** (schmale, gedämpfte Spalte), **Eingabe rechts**; auf schmalen
  Screens stapelt es (Label über Feld).
- **Keine Karten** mehr pro Feld — nur eine **feine Trennlinie** zwischen den
  Zeilen, wenig Padding.
- **Mikrofon dezent oben rechts IM Feld** (neue `variant="overlay"` der geteilten
  `DictationTextarea`; andere Screens unverändert).
- **Text-Felder** wachsen automatisch bis **max. 5 Zeilen**, danach manuelles
  Vergrößern (`resize-y`).
