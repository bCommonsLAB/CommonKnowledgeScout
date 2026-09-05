# Live-Transkription: Aufbau und Verlustsicherung

Das Mikrofon-Symbol an Textfeldern kann in zwei Betriebsarten laufen:

- **`batch`** (unverändert, Standard): aufnehmen, beim Loslassen am Stück an den
  Secretary schicken, Text zurückbekommen.
- **`live`**: Der Text erscheint während des Sprechens.

Umgeschaltet wird pro Einsatzort über `<DictationTextarea mode="live" …>`.

## Wege der Daten

```
Browser ──PCM 24 kHz──▶ OpenAI Realtime (WebSocket)
   │
   ├── Ticket ──▶ /api/secretary/realtime-session ──▶ Secretary /api/realtime/… ──▶ OpenAI
   └── Lücken-Mitschnitt ──▶ /api/secretary/process-audio (bestehender Batch-Weg)
```

Der Audiostrom läuft direkt vom Browser zum Anbieter. Der Secretary bleibt die
einzige Stelle mit dem Anbieter-Schlüssel und bestimmt Modell und Session-Vorgaben;
er gibt nur ein kurzlebiges Ticket heraus. Ein Relay durch Next.js und den Secretary
(WSGI, kein WebSocket) würde Latenz und Ausfallflächen addieren, ohne dass ein
anderer Empfänger entstünde.

## Was bei langen Aufnahmen passiert

Eine Live-Session endet beim Anbieter **nach 60 Minuten**, gleich was der Client tut.
Wer eine oder zwei Stunden spricht, braucht also Sessionwechsel:

- Ab Minute 50 wird bei der **nächsten Sprechpause** gewechselt (kostet kein Wort).
- Spätestens in Minute 55 wird **hart** gewechselt.
- Die Umschaltpause liegt im Puffer und wird nachgesendet.

Der Text wächst dabei fortlaufend; die Zeitrechnung läuft über die gesamte Aufnahme,
nicht je Session (`session-events.ts`).

## Warum kein gesprochener Text verloren geht

Vier Stufen, absteigend nach Häufigkeit:

1. **Normalbetrieb** — der Text kommt live.
2. **Kurze Störung** (bis 120 s) — der Ton wandert in den Puffer
   (`outbox.ts`) und wird nach der Wiederverbindung nachgesendet. Vollständig,
   nur verzögert. Wiederverbindung mit wachsender Wartezeit (0,5 s → max. 10 s),
   unbegrenzt oft, solange aufgenommen wird.
3. **Lange Störung** — läuft der Puffer über, übernimmt ein **eigener Mitschnitt**,
   der nur während der Störung läuft und deshalb eine in sich vollständige Datei
   ergibt. Sie wird über den bestehenden Batch-Weg nachtranskribiert und an der
   richtigen Stelle eingefügt. Der Puffer wird in diesem Fall verworfen — sonst
   stünde der Abschnitt doppelt im Text.
4. **Absturz des Browsers** — parallel läuft ein durchgehender Mitschnitt in Stücken
   in die lokale Ablage (IndexedDB, `recording-store.ts`), zusammen mit dem bereits
   erkannten Text.

Solange eine Lücke nicht nachgearbeitet ist, steht an ihrer Stelle sichtbar
`[… Aufnahme wird nachgearbeitet …]`. Nichts verschwindet stillschweigend; scheitert
die Nacharbeit, bleibt der Mitschnitt erhalten und die Lücke wird als `gescheitert`
ausgewiesen.

## Sprecher-Labels

Liefert das Modell Sprecher-Abschnitte (Server-Ereignis
`conversation.item.input_audio_transcription.segment` mit `speaker`), werden sie im
Text vorangestellt (`Sprecher A: …`) und ersetzen den ungegliederten Gesamttext
desselben Beitrags. Das Modell dafür ist `gpt-4o-transcribe-diarize`; ob der Anbieter
es an einer Realtime-Session annimmt, entscheidet er zur Laufzeit — bei Ablehnung
meldet der Ticket-Endpunkt `UPSTREAM_REJECTED`, statt still auf ein anderes Modell
auszuweichen. Die Auswertung der Sprecher-Abschnitte ist unabhängig davon fertig.

## Dateien

| Datei | Aufgabe |
|---|---|
| `lib/live-transcription/pcm.ts` | Float32 → 24 kHz → Int16 → Base64 |
| `lib/live-transcription/audio-capture.ts` | Mikrofon → PCM (AudioWorklet, Rückfall ScriptProcessor) |
| `lib/live-transcription/realtime-socket.ts` | WebSocket, Ereignis-Übersetzung |
| `lib/live-transcription/session-manager.ts` | Ablauf: verbinden, wechseln, puffern |
| `lib/live-transcription/gap-controller.ts` | Störungen: Mitschnitt und Nacharbeit |
| `lib/live-transcription/transcript-journal.ts` | Abschnitte, Sprecher, Lücken |
| `lib/live-transcription/recording-store.ts` | lokale Ablage (IndexedDB) |
| `components/shared/use-live-transcription.ts` | Hook |
| `components/shared/live-dictation-textarea.tsx` | Textfeld mit Live-Diktat |

## Grenzen

- **Keine Übersetzung.** Der Batch-Weg übersetzt `source_language → target_language`
  mit; die Live-Erkennung liefert nur die gesprochene Sprache. Wo beide Sprachen
  auseinanderfallen, braucht es einen Nachlauf über den Text-Endpunkt.
- **Der Ton verlässt die eigene Infrastruktur direkt.** Empfänger ist derselbe wie
  vorher, der Weg ist ein anderer — für Datenschutzerklärungen relevant.
- **Die Drosselung der Ticket-Ausgabe zählt pro Prozess**, nicht global.
