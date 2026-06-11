# meSpace — Meine Bibliothek bauen (Story-Inventur)

Einstufung: **K**ern (jeder Owner) · **G**estaltung (einfach, optional) ·
**E**xperte · **W**artung (selten, destruktiv) · **V**eraltet/defekt (→ 04).
Gliederung nach User-Review 2026-06-11 (Festlegungen F1–F8, siehe README §6).
**Leitnutzer:** Laie baut eine Library aus PDF-Dokumenten oder Interviews —
alles Technische läuft mit Standardwerten und liegt unter „Erweitert".

## Grundlagen

| Story (Als Owner möchte ich …) | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … meiner Library einen Namen geben | Allgemein / `library-form` | K | |
| … eine neue Library anlegen (lokal oder Cloud) | Allgemein, Willkommens-Ansicht | K | guter Einsteiger-Flow vorhanden (`settings-client.tsx`) |
| … die Library vorübergehend deaktivieren | Allgemein „Bibliothek aktivieren" | G | |
| … die Library endgültig löschen | Allgemein, Gefahrenzone | K | Bestätigungs-Dialog vorhanden — Vorbild für andere destruktive Aktionen |
| … eine interne Beschreibung hinterlegen | Allgemein | V | wird nirgends angezeigt (E4) |

## Speicherort — wird WIZARD (F1–F4, Design: [05-storage-wizard.md](05-storage-wizard.md))

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … meinen Speicherort geführt einrichten: Provider → Anmelden → Verzeichnis → Test | Storage-Formular, frei editierbar | K | Wurzelverzeichnis aus Storage-Listing wählen, KEIN Freitext-Pfad; Wizard endet IMMER mit Verbindungstest (separater Test-Button entfällt) |
| … mich neu anmelden, wenn mein Zugang abgelaufen ist | passiver Token-Status-Alert | K | Re-Auth-Flow extrahiert + app-weit: Trigger auch beim Archiv-Einstieg mit ungültigem Token (F2) — häufigste Fehlerquelle heute |
| … sehen, ob meine Verbindung aktiv ist | Token-Status (localStorage) | K | server-seitig prüfen (04/D7) |
| … App-Zugangsdaten einsehen (Tenant/Client/Secret, Nextcloud-App-Passwort) | editierbare Formularfelder | E | nach Einrichtung read-only (F3); Änderung nur durch erneuten Wizard-Durchlauf |
| … Google Drive anbinden | `gdrive-section` | V | entfernen (F4) |

## Inhaltstyp & Detailansicht — eigener Bereich mit Assistent (F5, F6)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … den Inhaltstyp meiner Library festlegen (Bücher, Sessions, Klima-Aktionen …) | Story „Detailansicht-Typ" | K | als kleiner **Assistent**: Typ wählen → typabhängige Folgefragen; lädt Standard-Facetten für die Galerie mit |
| … typabhängige Optionen setzen (z.B. SDG-Profil nur bei Klima-Inhalten) | Story „SDG-Profil anzeigen" | G | erscheint nur, wenn der Inhaltstyp es hergibt (F6) — nicht mehr als freier Schalter |
| … sehen, wie die Detailansicht für meinen Typ aussieht | — | G | Vorschau/Beispiel im Assistenten (neu) |

## Galerie — wie man Stories findet (F5)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … Kartendichte und Gruppierung einstellen | Story „Wissensgalerie" | G | |
| … Standard-Filter für meinen Inhaltstyp übernehmen | Story „Standard für …" | G | kommt aus dem Inhaltstyp-Assistenten |
| … Filter/Facetten im Detail konfigurieren | `FacetDefsEditor` | E | bleibt im Galerie-Bereich, aber als klar abgegrenztes Experten-Werkzeug (9 Felder je Facette + JSON-Import/Export) |
| … den Wissens-Graphen ein-/ausschalten | Story „Graph-Modus" | G | nur An/Aus ist Einsteiger-tauglich |

## Chat (F5)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … Hinweistext, Zeichenlimit und Warnmeldung des Eingabefelds anpassen | Story „Chat UI" | G | |
| … Footer-Text und -Link setzen | Story | G | |
| … Ton/Stil der KI-Antworten wählen (Charakter, Sozialkontext) | Story „Eigene Perspektive" | G | laienverständlich formulieren |
| … Sprache der Antworten festlegen | Story „Zielsprache" | K | Dublette mit Verarbeitung auflösen (04/C2) — EIN Ort |

## Verarbeitung (redaktionell)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … ein Standard-Template für die Transformation wählen | Transformation „Template" | K | Dropdown aus MongoDB + Custom — gut |
| … die Zielsprache der Inhalte festlegen | Transformation | K | siehe Dublette (Chat) |
| … automatisch ein Cover-Bild erzeugen lassen | Transformation | G | |
| … den Prompt für Cover-Bilder anpassen | Transformation „Coverbild-Prompt" | E | → Erweitert |

## Erweitert (Experten-Werkzeuge und Wartung — F7, F8)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … das LLM-Modell für Chat-Antworten wählen | Story | E | per F8 zu Erweitert; vorher B5 klären (wird der Wert überhaupt gelesen?) |
| … das LLM-Modell für die Transformation wählen | Transformation | E | F8 |
| … die PDF-Extraktionsmethode ändern | Transformation | E | Standardwert für Laien; rohe Enum-Werte ersetzen |
| … Embedding-Modell, Dimension, Chunking konfigurieren | Story „RAG Konfiguration" | E | Standardwerte; Änderung erzwingt Re-Indexierung — Hinweis nötig |
| … den Such-Index verwalten | „SearchIndex"-Dialog, `index-definition-dialog` | E/W | **F7: automatisieren** — Anlage/Rebuild ohne User-Aktion (z.B. nach Facetten-/Embedding-Änderung); Dialoge nur noch als Experten-Diagnose; Atlas-Definition-Kopieren entfällt für normale Nutzer |
| … Graph-Darstellung im Detail steuern (Kantenquelle, Größe/Farbe/Transparenz) | Story „Graph-Modus" | E | |
| … KI-Beziehungsanalyse erlauben | Story „Beziehungen berechnen" | E | schaltet teure LLM-Läufe frei |
| … pro Library eigenen Azure-Blob-Container nutzen | Story „Binary Storage" | E | F8; fachlich Storage-Thema (04/C4) |
| … Thumbnail-Bestand sehen und reparieren | Story „Binary Storage" | W | F8; „Neu berechnen" überschreibt ALLE Thumbnails |
| … Cache/Speicherstrategie steuern (Shadow-Twin-Flags, Strategie-Panel) | Allgemein | E | F8; Legacy-Upgrade als Banner statt Feld (04/C1) |
| … Storage↔Cache-Sync prüfen, exportieren, migrieren, Sprach-Artefakte bereinigen | Allgemein (Analyse/Export/Migration/Bereinigung) | W | destruktive Aktionen mit einheitlichem Bestätigungs-Muster (04/D3, D6) |
| … Library-Konfiguration als JSON exportieren/importieren | Allgemein, Import/Export-Card | E | F8 |
| … eigene Service-Verbindung konfigurieren (API-URL/Key, Desktop-Modus) | Transformation „Secretary Service" | E | F8; apiKey-Maskierung fixen (04/D5) |
| … DIVA-Lieferdaten auswerten + Archiv-Defaults setzen | Allgemein, DIVA-Block | E | F8; nur bei DIVA-Inhaltstypen zeigen |
| … Schwellwert für Auto-Klassifikation setzen | Allgemein „Auto-Übernahme ab Konfidenz" | E | F8 |
| … Teams-Stream-Relay steuern | Transformation, Panel | E | Electron-only |

## Zählung

~50 Stories. Einsteiger-Pfad (K+G) nach dem neuen Schnitt: **~20 Stories in
fünf kleinen Bereichen** (Grundlagen, Speicherort-Wizard, Inhaltstyp-Assistent,
Galerie, Chat, Verarbeitung) — alles andere liegt gebündelt unter „Erweitert".
