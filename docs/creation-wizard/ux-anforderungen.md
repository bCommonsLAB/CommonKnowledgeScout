# Creation-Wizard: UX-Anforderungen (vor dem Refactor)

> **Status: ENTWURF — wartet auf User-Abnahme.**
>
> Dieser Pfad ist im Strategie-Plan (`welle-3vi-creation-wizard-ux-first`)
> festgelegt: Die UX-Bedürfnisse werden **vor** dem Refactor dokumentiert und
> abgenommen, damit der Refactor die finale UX einfriert.
>
> Das Skelett ist aus der Schwachstellen-Analyse
> (`docs/analysis/wizard-template-schwachstellen-architektur-und-ux.md`, §2)
> vorbefüllt. Bitte je Punkt entscheiden: **übernehmen / anpassen / verwerfen**.

## Leitbild

> Der Wizard soll einem **einfachen Anwender** ermöglichen, eine Story oder
> Daten zu erfassen — ohne technisches Vorwissen, mit verlässlichem Feedback
> und einem klaren Standardweg.

## Offene UX-Entscheidungen (bitte ausfüllen)

### A. Standardpfad ("ein Klick → fertig")
- [ ] Gibt es für den einfachen Fall einen **Ein-Klick-Pfad** mit sinnvollen
      Defaults? Welche Schritte sind dann optional/eingeklappt?
- [ ] Welche Bestätigungen (`hasConfirmedMarkdown`, `hasConfirmedSources`) sind
      für den einfachen Anwender wirklich nötig — welche entfallen?

### B. Orientierung & Fortschritt
- [ ] Soll die **Schrittzahl fix** sein (bedingte Schritte vorab ausgegraut)
      statt dynamisch zu verschwinden?
- [ ] Menschenlesbare Step-Labels statt Preset-Namen — wer pflegt die Texte
      (Template-Autor? feste Defaults)?
- [ ] Wie sollen **lange Operationen** (OCR/Transkription/LLM) kommuniziert
      werden (Wartehinweis, Hintergrund, Abbrechen)?

### C. Feedback & Fehler
- [ ] Einheitliche Fehleranzeige: ein zentrales Status-/Fehlerelement statt
      gemischt Toast/Inline/Alert. Wie soll es aussehen/platziert sein?
- [ ] Bei deaktiviertem "Weiter": soll der **Grund** sichtbar sein?
- [ ] Was sieht der Anwender, wenn ein Template kaputt ist (heute: leerer
      Schritt)? Gewünschte Fehlermeldung?

### D. "Weiter"-Verhalten
- [ ] Soll vor langlaufenden Aktionen (Extraktion, Publish) eine **Vorschau der
      nächsten Aktion** erscheinen, statt nur "Weiter"?
- [ ] Sind getrennte Buttons ("Verarbeiten", "Speichern", "Publizieren")
      gewünscht statt eines überladenen "Weiter"?

### E. Inhaltliche Erklärung
- [ ] Soll der Welcome-Schritt **template-/story-spezifisch** erklären, was
      passiert (statt generischem Text)?
- [ ] Sollen nicht-erfasste Pflichtfelder sichtbar gemacht werden (heute
      verschwinden ungelistete Felder still)?

### F. Template-Verwaltung (separat, niedrigere Prio)
- [ ] Brauchen Content-Autoren ein **anfängertaugliches Template-UI**
      (visueller Builder + Live-Validierung) statt Markdown/JSON-Editor?

## Abnahme

| Punkt | Entscheidung | Datum |
|---|---|---|
| A–F | offen | — |

Nach Abnahme: Sub-Wellen 3-VI-b…f starten
(`docs/refactor/welle-3-vi-creation-wizard/00-refactor-plan.md`).
