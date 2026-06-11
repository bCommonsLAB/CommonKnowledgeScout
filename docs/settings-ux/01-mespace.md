# meSpace — Meine Bibliothek bauen (Story-Inventur)

Einstufung: **K**ern (jeder Owner) · **G**estaltung (einfach, optional) ·
**E**xperte · **W**artung (selten, destruktiv) · **V**eraltet/defekt (→ 04).
„Heute" = Tab/Komponente im Ist-Zustand.

## Grundlagen

| Story (Als Owner möchte ich …) | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … meiner Library einen Namen geben | Allgemein / `library-form` | K | |
| … eine neue Library anlegen (lokal oder Cloud) | Allgemein, Willkommens-Ansicht | K | guter Einsteiger-Flow vorhanden (`settings-client.tsx`) |
| … die Library vorübergehend deaktivieren | Allgemein „Bibliothek aktivieren" | G | |
| … die Library endgültig löschen | Allgemein, Gefahrenzone | K | Bestätigungs-Dialog vorhanden — Vorbild für andere destruktive Aktionen |
| … eine interne Beschreibung hinterlegen | Allgemein | V | wird nirgends angezeigt (E4) |

## Speicherort

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … wählen, wo meine Dateien liegen (lokal/OneDrive/Nextcloud) | Storage „Speichertyp" | K | Typ-Wechsel bestehender Library heute OHNE Warnung — Gefahren-UX nötig |
| … den Wurzelpfad festlegen | Storage „Speicherpfad" | K | Placeholder nicht provider-spezifisch — verwirrend |
| … mich per Klick bei OneDrive an-/abmelden | Storage, OAuth-Flow | K | Abmelden kappt Zugriff ohne Bestätigung |
| … sehen, ob meine Cloud-Verbindung aktiv ist | Storage, Token-Status | K | nur localStorage-basiert, kein Server-Ping |
| … OneDrive-App-Zugangsdaten hinterlegen (Tenant/Client/Secret) | Storage | E | Azure-Portal-Wissen nötig; System-Defaults via `oauth-defaults` unsichtbar — Zwei-Ebenen-Logik erklären oder verbergen |
| … Nextcloud per WebDAV anbinden (URL/User/App-Passwort) | Storage | E | exaktes URL-Format nötig, kein Validierungs-Feedback |
| … Google Drive anbinden | Storage | V | Attrappe: kein Provider, kein OAuth (E3) |
| … die Verbindung testen, bevor ich arbeite | Storage „Storage testen" | K | Ergebnis-Dialog zeigt rohe Logs — Einsteiger-Ansicht nötig |

## Verarbeitung (redaktionell)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … festlegen, wie Text aus PDFs extrahiert wird | Transformation „PDF-Extraktionsmethode" | E | Dropdown zeigt rohe Werte (`mistral_ocr`, `llm_and_ocr` …) ohne Erklärung; Default inkonsistent (Schema `native` vs. Reset `mistral_ocr`) |
| … ein Standard-Template für die Transformation wählen | Transformation „Template" | K | Dropdown aus MongoDB + Custom-Eingabe — gut |
| … das LLM-Modell für Transformation wählen | Transformation | E | |
| … die Zielsprache der Inhalte festlegen | Transformation „Zielsprache" | K | doppelt geführt mit `chat.targetLanguage` (04 / C2) |
| … automatisch ein Cover-Bild erzeugen lassen | Transformation | G | |
| … den Prompt für Cover-Bilder anpassen | Transformation „Coverbild-Prompt" | E | Template-Variablen `{{title}}`/`{{summary}}` |

## Erlebnis (Story + Galerie)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … Hinweistext/Zeichenlimit/Warnung des Chat-Eingabefelds anpassen | Story „Chat UI" | G | |
| … Footer-Text und -Link im Chat setzen | Story | G | |
| … Sprache der Chat-Antworten festlegen | Story „Zielsprache" | K | siehe Dublette oben |
| … Ton/Stil der KI-Antworten wählen (Charakter, Sozialkontext) | Story „Eigene Perspektive" | G | gut laienverständlich machbar |
| … das LLM-Modell für Chat-Antworten wählen | Story | E/V? | `models.chat` wird vermutlich nirgends gelesen — prüfen (04 / B5) |
| … den Inhaltstyp der Library festlegen (book, session, climateAction …) | Story „Detailansicht-Typ" | K | bestimmt Detail-Layout; `testimonial`/`blog` still deprecated (E5) |
| … SDG-Profil in der Detailansicht zeigen | Story | G | nur für bestimmte Inhaltstypen relevant — daran koppeln |
| … Kartendichte und Gruppierung der Galerie einstellen | Story „Wissensgalerie" | G | |
| … Filter/Facetten der Galerie konfigurieren | Story, `FacetDefsEditor` | E | 9 Felder je Facette + JSON-Import/Export — reines Experten-Werkzeug, heute mitten in der Galerie-Sektion |
| … Standard-Facetten für meinen Inhaltstyp laden | Story „Standard für …" | G | guter Einsteiger-Einstieg in Facetten |
| … den Wissens-Graphen aktivieren | Story „Graph-Modus" | G | An/Aus ist einfach … |
| … Graph-Darstellung steuern (Kantenquelle, Größe/Farbe/Transparenz-Felder) | Story | E | … Feld-Encoding ist Expertenwissen |
| … KI-Beziehungsanalyse erlauben | Story „Beziehungen berechnen" | E | schaltet teure LLM-Läufe frei |
| … DIVA-Lieferdaten auswerten + Archiv-Defaults setzen | Allgemein, DIVA-Block | E | branchenspezifisch — nur bei DIVA-Inhaltstypen zeigen |
| … Schwellwert für Auto-Klassifikation setzen | Allgemein „Auto-Übernahme ab Konfidenz" | E | gehört fachlich zur Galerie/Klassifikation, nicht zu Stammdaten |

## Erweitert (Experten-Werkzeuge und Wartung)

| Story | Heute | Stufe | Anmerkung |
|---|---|---|---|
| … Embedding-Modell, Dimension, Chunk-Größe/-Overlap konfigurieren | Story „RAG Konfiguration" | E | Änderung erzwingt Re-Indexierung — heute kein Hinweis |
| … den Such-Index prüfen/anlegen/löschen | Story „SearchIndex"-Dialog | E/W | Index löschen unterbricht Suche; Dialog gut absichert |
| … die Atlas-Index-Definition kopieren | `index-definition-dialog` | E | |
| … pro Library eigenen Azure-Blob-Container nutzen | Story „Binary Storage" | E | fachlich Storage-Thema, nicht Story (Sektion verschieben) |
| … Thumbnail-Bestand sehen und reparieren | Story „Binary Storage" | W | SSE-Streams; „Neu berechnen" überschreibt ALLE Thumbnails |
| … prüfen, ob Storage und Cache synchron sind (Dry-Run) | Allgemein „Analysieren" | W | sinnvolles Diagnose-Tool |
| … Cache-Artefakte ins Dateisystem exportieren | Allgemein „Exportieren" | W | überschreibt ohne Bestätigung |
| … Dateisystem-Artefakte in den Cache importieren (Migration) | Allgemein, Migration-Wizard | W | inkl. destruktivem „Dateien aufräumen"-Switch; `window.confirm` |
| … fehlerhafte Sprach-Artefakte analysieren und löschen | Allgemein „Sprach-Bereinigung" | W | unwiderruflich; Analyse-vor-Löschen-Muster ist gut |
| … Speicherstrategie (Cache/Dateisystem/Azure) steuern und sehen | Allgemein, Shadow-Twin-Flags + Strategie-Panel | E | „Primary Store (Legacy)"-Wording; Legacy-Modus-Upgrade als Banner statt Feld (04 / C1) |
| … Library-Konfiguration als JSON exportieren/importieren | Allgemein, Import/Export-Card | E | Import ohne Bestätigung |
| … eigene Service-Verbindung konfigurieren (API-URL/Key, Desktop-Modus) | Transformation „Secretary Service" | E | Betreiber-Thema; apiKey geht heute an den Client (04 / D5) |
| … Teams-Stream-Relay steuern | Transformation, Panel | E | Electron-only, im Web unsichtbar |

## Zählung

~55 Stories. Davon Einsteiger-relevant (K+G): ~24 — der Rest ist Experten-/
Wartungs-Territorium, das heute ungeschützt zwischen den Kern-Feldern liegt.
