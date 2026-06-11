# weSpace — Gemeinsam arbeiten (Story-Inventur)

Einstufung wie in [01-mespace.md](01-mespace.md). Quellen heute:
`members-list.tsx`, `invite-user-dialog.tsx` (+ Hooks), Teile von
`access-requests-list.tsx`.

## Rollenmodell (Ist)

| Rolle | Entsteht durch | Datenmodell | Kann |
|---|---|---|---|
| `co-creator` | Mitglieder-Einladung | `LibraryMember` | Archiv/Explore/Story/Templates, keine Settings |
| `moderator` | Mitglieder-Einladung | `LibraryMember` | Anfragen verwalten, Einladungen senden |
| `reader` | genehmigte Zugriffsanfrage | `LibraryAccessRequest` | nur lesen |

Zwei parallele Datenmodelle für „Person hat Zugang" — Hauptursache der
UX-Verwirrung (zwei fast identische Einladungs-Dialoge mit völlig
unterschiedlicher Wirkung).

## Stories

| Story (Als Owner möchte ich …) | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … eine vertraute Person mit Rolle einladen (Mitarbeit) | Mitglieder „Mitglied einladen" | K | nur co-creator/moderator wählbar; kein Freitext-Feld |
| … eine vertraute Person als Leser einladen | Zugriffsanfragen „Benutzer einladen" | K | anderer Flow, anderes Datenmodell, MIT Freitext — Inkonsistenz |
| … die Rollen verstehen, bevor ich sie vergebe | — | K | heute nirgends erklärt (Shadow-Twin-Teilung bei co-creator!) |
| … alle Personen mit Zugang auf einen Blick sehen (inkl. Leser) | — | K | **Lücke**: Leser erscheinen nur im „Genehmigt"-Filter der Anfragen |
| … eine offene Einladung erneut senden | beide Listen | G | doppelt implementiert |
| … eine Einladung zurückziehen / ein Mitglied entfernen | Mitglieder | K | `window.confirm`; Konsequenzen (Co-Creator verliert Shadow-Twin-Zugriff) nicht dargestellt |
| … als Moderator Einladungen/Anfragen verwalten, ohne Owner-Settings zu sehen | — | K | **Lücke**: `layout.tsx` kennt nur Owner/Co-Creator; Moderatoren haben keinen Zugangspunkt (E7) |

Als Eingeladene(r): Annahme-Flow per E-Mail-Link existiert (Token in
`LibraryAccessRequest` bzw. Member-Bestätigung) — im Redesign als Teil der
weSpace-Story mitdenken (Onboarding-Erlebnis der eingeladenen Person).

## Zielbild

**EIN Einladungs-Flow** mit Rollenwahl (Leser / Moderator / Co-Creator),
einheitlichem Freitext, einheitlicher Wiedervorlage („erneut senden") und
**einer Personen-Übersicht** über beide Datenmodelle hinweg. Backend-Modelle
können vorerst getrennt bleiben (UI-Vereinheitlichung zuerst, Daten-Migration
später als eigene Entscheidung).

Offene User-Entscheidung E1 (README §6): Gehören aktiv eingeladene Leser zu
weSpace (Empfehlung) oder zu usSpace?

## Zählung

~8 Stories (davon 3 heute ganz fehlend: Rollen-Erklärung, Personen-Übersicht,
Moderator-Zugang).
