# usSpace — Veröffentlichen (Story-Inventur)

Einstufung wie in [01-mespace.md](01-mespace.md). Quellen heute:
`public/public-form.tsx`, `access-requests-list.tsx` (Gateway-Teil),
API `PUT /api/libraries/[id]/public`, `publish-site`/`depublish-site`.

## Stories — Öffentlicher Auftritt

| Story (Als Owner möchte ich …) | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … meine Library öffentlich schalten | „Library veröffentlichen"-Switch | K | Folgen für Laien unklar — Vorschau/Erklärung nötig |
| … eine einprägsame URL festlegen | „Slug-Name" | K | Live-Verfügbarkeitsprüfung vorhanden — gut |
| … den fertigen Link kopieren und weitergeben | „Öffentlicher Link" | K | |
| … öffentlichen Namen und Beschreibung pflegen | „Öffentlicher Name/Beschreibung" | K | |
| … Icon und Hintergrundbild wählen | Icon-Dropdown, Bild-URL | G | Bild nur als externe URL, kein Upload |
| … entscheiden, ob meine Library auf der Plattform-Startseite erscheint | „Show on Homepage" | G | englisches Label im deutschen UI |
| … Galerie-Texte (Headline, Untertitel, Filter-Erklärung) pflegen | — | K | **defekt**: Schema + Defaults existieren (SFSCon-Hardcodes), kein UI-Feld, wird nie gesendet; Galerie liest die Werte bereits — E2 entschieden: **fertig bauen** |

## Stories — Startseite

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … eine eigene Startseite aktivieren | „Startseite anzeigen" | G | heute unabhängig von `isPublic` — konzeptionell verwirrend |
| … den Entwurf vor Live-Schaltung testen | „Draft testen" | K | Auto-Save vor Öffnen — gutes Muster |
| … die Startseite publizieren / neu publizieren | „Veröffentlichen" | K | Azure-Snapshot-Konzept erklären (Version, Stand) |
| … die Startseite zurückziehen | „Depublizieren" | K | |

## Stories — Zugang & Anfragen (Gateway für Fremde)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … Zugriff auf freigegebene Nutzer beschränken | „Zugriff nur für freigegebene Benutzer" | K | Zusammenspiel mit Anfragen heute unerklärt |
| … eingehende Anfragen sehen und filtern | Zugriffsanfragen-Liste | K | Status-Filter vorhanden |
| … eine Anfrage genehmigen/ablehnen | Genehmigen/Ablehnen | K | welcher Zugriff vergeben wird, steht nirgends |
| … eine Anfrage endgültig entfernen | „Entfernen" | G | `window.confirm`; **prüfen**: entzieht das Löschen einer genehmigten Anfrage den Leser-Zugriff wirklich? (04 / D4, sicherheitsrelevant) |

## Außenwirkung (besondere Sorgfalt im Redesign)

| Aktion | Wirkung | Heute abgesichert? |
|---|---|---|
| `isPublic` speichern | Library sofort anonym sichtbar | nein (normaler Save) |
| Startseite publizieren | Azure-Blob öffentlich abrufbar | Button, reversibel via Depublizieren |
| Einladung/Genehmigung | E-Mail geht raus / Zugriff erteilt | teils `window.confirm` |

usSpace ist der Raum mit Außenwirkung — jede Aktion braucht klare
Zustandsanzeige („Was sehen Fremde JETZT?"). Empfehlung: Status-Header im
Raum („Privat / Öffentlich ohne Schutz / Öffentlich mit Freigabe…") statt
verstreuter Switches.

## Zählung

~15 Stories. Einsteiger-tauglich machbar bis auf Snapshot-/Auth-Konzepte,
die erklärt werden müssen.
