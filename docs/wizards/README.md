# Wizard-Konzepte (Was soll jeder Assistent leisten?)

> Diese Sammlung beschreibt **pro Erfassungs-Assistent** in einfacher Sprache:
> sein Ziel, die User-Story (warum), was bei jedem Schritt passiert, und was er
> **bewusst nicht** tut (damit niemand überfordert wird). Sie ist gleichzeitig
> Abstimmungs-Dokument für Menschen **und** Prüf-Vorlage für den Agenten.

## Wofür das gut ist

- **Abstimmen mit Menschen:** ein Konzept liest sich ohne Technik-Wissen und kann
  mit Kolleg:innen/Community besprochen werden.
- **Abnahme durch dich:** du bestätigst pro Assistent „so soll es sein".
- **Testen durch den Agenten:** jeder Abschnitt **Erfolgskriterien** ist so
  formuliert, dass der Agent ihn in (automatische oder manuelle) Tests übersetzen
  kann — ohne raten zu müssen.
- **Lebende Doku:** das abgenommene Konzept bleibt die Wahrheit, an der sich Code
  und Tests messen.

## Arbeitsweise (der Kreislauf)

1. **Entwurf** — der Agent schreibt/aktualisiert das Konzept (dieses Format).
2. **Abnahme** — du liest, korrigierst, bestätigst.
3. **Test** — der Agent leitet aus den Erfolgskriterien Tests ab und prüft sie
   (automatisch wo möglich, sonst Klick-Anleitung).
4. **Pflege** — ändert sich der Wunsch, ändern wir zuerst hier, dann Code/Tests.

## Format (jedes Konzept hat dieselben Abschnitte)

1. **Ziel** — 1–2 Sätze: was am Ende entsteht, für wen, welcher Nutzen.
2. **User-Story** — „Als … möchte ich … damit …".
3. **Wann benutzen — und wann nicht** — klare Abgrenzung zu anderen Assistenten.
4. **Die Schritte** — pro Schritt: was der **Mensch** tut, was das **System**
   tut, **warum**, und die **Falle** (was überfordern würde).
5. **Bewusst NICHT** — Anti-Scope: was wir absichtlich weglassen.
6. **Erfolgskriterien** — abhakbare Aussagen; markiert ob *automatisch* prüfbar
   oder *nur im UI*.
7. **Offene Fragen** — was noch zu entscheiden ist.

## Übersicht der Assistenten

| Assistent | docType / Renderer | Status |
|---|---|---|
| [Event erfassen (Story aus Ordner)](event.md) | event / session | 🟢 Format abgenommen, Anforderungen eingearbeitet |
| [Testimonial erfassen](testimonial.md) | testimonial / testimonial | 🟢 Entwurf |
| [Dialograum-Ergebnis erfassen](dialograum.md) | dialograum / blog | 🟢 Entwurf |
| [Geräte-Steckbrief erfassen](pc-steckbrief.md) | refurbedDevice / refurbedDevice | 🟢 Entwurf (Renderer-Drift) |
| [Event finalisieren](event-final.md) | event (extends) / session | 🟢 Entwurf |
| ~~pdfanalyse~~ | book | ➖ kein Assistent (schema-only, läuft im Hintergrund) |

**Flows (kein Schritt-Assistent, aber gleiches Konzept-Format):**

| Flow | Worum | Status |
|---|---|---|
| [Dokumente hochladen → analysieren → abnehmen → publizieren](dokument-upload-analyse-publizieren.md) | Library per Upload aufbauen, Hintergrund-Analyse, Freigabe, Publikation | 🟡 Entwurf — **aktueller Fokus** |

### Querschnitt-Prinzip (gilt für alle Flows)

Jeder Flow erzeugt ein Ergebnis eines bestimmten **DetailViewType**. Dessen
**Pflichtfelder** (`VIEW_TYPE_REGISTRY.requiredFields`) sind das, was am Ende
**abgenommen** werden muss — **systemisch ableitbar**, nicht pro Vorlage
diktiert. (Offen: ob nur die *inhaltlichen* Pflichtfelder gemeint sind.)

Die `auto`-Erfolgskriterien sind in
[`tests/unit/creation/wizard-concepts.test.ts`](../../tests/unit/creation/wizard-concepts.test.ts)
abgesichert (Soll-Verhalten je Assistent: Quelltypen, gebundene Felder, Renderer
inkl. Drift, Kompatibilität).

## Bezug zu Modell & Tests

- Modell-Entscheidungen: [`docs/adr/0003-wizard-schema-template-trennen.md`](../adr/0003-wizard-schema-template-trennen.md)
- Prüfstand-Vorlagen: [`test-library/`](../../test-library/README.md)
- Bereits abgesichertes Verhalten (Naht für Phase 3a):
  [`src/lib/creation/wizard-flow.ts`](../../src/lib/creation/wizard-flow.ts) +
  [`tests/unit/creation/wizard-flow.test.ts`](../../tests/unit/creation/wizard-flow.test.ts)
