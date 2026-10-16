# ADR 0011 — Zusammenarbeit in Stufen: geliehener Speicherzugang, Urheberschaft am Artefakt, Commons

- **Status**: Akzeptiert (2026-10-16), Umsetzung geplant ab 2026-10-23
- **Datum**: 2026-10-16
- **Entscheider**: Repo-Owner
- **Löst ab**: die vorgeschlagene Richtung von
  [ADR 0005](0005-co-creator-eigene-storage-auth.md) als Normalfall. Die eigene
  Speicher-Verbindung je Mitglied bleibt eine spätere, höhere Stufe.
- **Plan**: [`plans/geplant/zusammenarbeit-in-stufen.plan.md`](../plans/geplant/zusammenarbeit-in-stufen.plan.md)

## Kontext

Schritt A4 des Plans `speicher-verbindungen-und-library-anlage` hätte
Co-Creators auf Nextcloud-/OneDrive-Libraries ohne eigene Speicher-Verbindung
den Archiv-Zugriff entzogen (ADR 0005). Der Owner will das Gegenteil:
Zusammenarbeit soll niederschwellig beginnen. Wer eine gemeinsame Library
aufbaut, soll nicht zuerst Rechte im Speicher pflegen müssen.

Befund im Code (2026-10-16):

- Rollen sind fest (`owner`, `moderator`, `co-creator`, `contributor`); ein
  Co-Creator hat im Archiv immer volle Rechte, „nur lesen" gibt es nicht.
- Co-Creators arbeiten auf Nextcloud/OneDrive bereits mit der Verbindung des
  Owners, aber stillschweigend (`getServerProvider`).
- `generated_by` an Transkript und Transformation nennt die Maschine
  (`knowledgescout/pipeline`), nicht die Person. Die handelnde Person steht nur
  am Job (`userEmail`), im Brücken-Protokoll (`akteur`) und bei Korrekturen
  (`revised_by`, `flagged_by`). Im Speicher erscheint alles als Werk des
  Owners.

## Entscheidung

1. **Geliehener Speicherzugang ist ein ausdrücklicher Modus.** Der Owner gibt
   ihn je Mitglied frei. Er ist für beide Seiten sichtbar: das Mitglied sieht im
   Archiv „Sie arbeiten mit dem Speicherzugang von …", die Mitgliederliste zeigt,
   wer das tut. Zugangsdaten verlassen nie den Server.
2. **Urheberschaft steht am Artefakt, nicht in einem zentralen Register.** Zwei
   flache Felder (Frontmatter-Regel): `erstellt_von` (E-Mail der Person, immer)
   und `im_namen_von` (E-Mail des Owners, nur bei geliehenem Zugang). Sie stehen
   an Markdown-Dateien, an Transkript und Transformation (Frontmatter und
   Twin-Dokument) und am Index-Eintrag (beim Ingest übernommen). Binäre Quellen
   tragen sie über ihren Shadow Twin (`quelle_erstellt_von`). `generated_by`
   bleibt die Maschine.
3. **Lesen umfasst die ganze Library; Schreiben hängt an Funktionen.** Keine
   Rechte je Verzeichnis. Drei Voreinstellungen je Mitglied:
   - **Lesen**: Archiv, Galerie, Story; nichts schreiben.
   - **Eigenes**: hochladen, Ordner anlegen, transkribieren und transformieren
     (auch fremde Quellen; es entsteht ein neues, eigenes Artefakt); Eigenes
     ändern, verschieben, löschen. Nicht publizieren.
   - **Mitgestalten**: zusätzlich Fremdes ändern, verschieben, löschen und
     publizieren (= heutiger Co-Creator).
   Die Einstellungen der Library bleiben in allen Stufen beim Owner.
4. **Eine Prüfstelle auf dem Server.** Jede schreibende Handlung aus App,
   Brücke und Jobs prüft im Moment der Handlung die aktuelle Identität (E-Mail)
   und deren Voreinstellung gegen `erstellt_von` des betroffenen Artefakts.
   Ordner-Operationen betreffen alles darin. Jede schreibende Handlung wird mit
   der Person protokolliert.
5. **Altbestand** ohne `erstellt_von` gehört dem Owner: eine einmalige
   Migration setzt das Feld an Twins und Index-Einträgen; für Rohdateien ohne
   Twin gilt diese Regel ausdrücklich dokumentiert, nicht als stiller Rückfall.
6. **Commons-Libraries.** Wird eine Library als Commons freigegeben, sind ihre
   Originale für alle unveränderlich; der Owner ändert nur als neue Fassung, die
   alte bleibt adressierbar. Kopieren in die eigene Library ist frei; die Kopie
   trägt `abgeleitet_von` (Adresse `@<slug>/<pfad>`) und `urheber_original`. Eine
   Lizenz (z. B. CC BY-SA) ist beim Freigeben Pflicht. Öffentlich erscheint der
   Anzeigename, die E-Mail nur intern. Zuerst gilt das für Galerie-Inhalte und
   Transformationen, Rohdateien später.

## Konsequenzen

- Die Grenze liegt bei geliehenem Zugang in KnowledgeScout, nicht im Speicher.
  Wer selbst direkten Speicherzugang hat (Nextcloud-Oberfläche, Sync-Ordner),
  umgeht KnowledgeScout; Co-Creators mit geliehenem Zugang haben den nicht.
- Die offene Kante aus ADR 0008 (Brücken-Schlüssel mit allen Rechten seines
  Besitzers) schließt sich für Mitglieder: über die Brücke gilt ihre
  Voreinstellung.
- Pipeline, Upload, Brücke und Ingest müssen `erstellt_von`/`im_namen_von`
  setzen; ein Artefakt ohne Feld nach der Migration ist ein Fehler, kein
  Default.
- A4 des Speicher-Plans entfällt in seiner bisherigen Form und geht in diesem
  Plan auf.
