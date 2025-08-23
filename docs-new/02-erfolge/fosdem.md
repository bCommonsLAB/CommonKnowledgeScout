---
title: FOSDEM 2025 - 600+ Vorträge automatisch dokumentiert
description: Wie wir Europas größte Open Source Konferenz mit KI dokumentiert haben
---

# FOSDEM 2025 - Eine Erfolgsgeschichte

## Die Ausgangslage

**FOSDEM** (Free and Open Source Software Developers' European Meeting) ist mit über 8000 Teilnehmern die größte Open Source Konferenz Europas. Jedes Jahr in Brüssel, hunderte Vorträge, dutzende parallel laufende Tracks.

### Das Problem
- 600+ Vorträge in nur 2 Tagen
- 50+ parallele Tracks
- Vorträge in verschiedenen Sprachen
- Folien, Code-Demos, Diskussionen
- Alles sollte für die Community dokumentiert werden

**Die traditionelle Lösung:** Monate manueller Arbeit - wenn überhaupt.

## Unsere Lösung: Secretary Service + Knowledge Scout

### Phase 1: Automatisches Harvesting
```python
# Alle FOSDEM Videos von YouTube/PeerTube sammeln
fosdem_tracks = [
    "Main Track", "Security", "Containers", 
    "Open Research", "Community", "JavaScript",
    # ... 50+ tracks
]

for track in fosdem_tracks:
    videos = youtube_api.get_playlist(track)
    secretary_service.queue_for_processing(videos)
```

### Phase 2: Intelligente Verarbeitung

Für jeden Vortrag automatisch:

1. **Video-Download** in höchster Qualität
2. **Audio-Extraktion** und Optimierung
3. **Transkription** mit OpenAI Whisper
   - Automatische Spracherkennung
   - Technische Begriffe korrekt erfasst
4. **Folien-Extraktion** aus Video-Frames
   - OCR für Text in Folien
   - Code-Snippets erkannt
5. **GPT-4 Strukturierung**
   - Zusammenfassung
   - Key Takeaways
   - Technische Details
   - Links und Ressourcen

### Phase 3: Wissensorganisation

Alle verarbeiteten Inhalte landen strukturiert in Knowledge Scout:

```
FOSDEM 2025/
├── Main Track/
│   ├── Opening Keynote/
│   │   ├── transcript.md
│   │   ├── summary.md
│   │   ├── slides.pdf
│   │   └── metadata.json
│   └── ...
├── Developer Rooms/
│   ├── Rust/
│   ├── Python/
│   ├── JavaScript/
│   └── ...
└── Lightning Talks/
```

## Die Zahlen

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0;">

<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center;">
<h3 style="color: #0369a1; margin: 0;">600+</h3>
<p>Vorträge verarbeitet</p>
</div>

<div style="background: #fef3c7; padding: 20px; border-radius: 8px; text-align: center;">
<h3 style="color: #d97706; margin: 0;">72h</h3>
<p>Gesamtverarbeitung</p>
</div>

<div style="background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center;">
<h3 style="color: #047857; margin: 0;">15.000+</h3>
<p>Seiten Transkript</p>
</div>

<div style="background: #fce7f3; padding: 20px; border-radius: 8px; text-align: center;">
<h3 style="color: #be185d; margin: 0;">0</h3>
<p>Manuelle Eingriffe</p>
</div>

</div>

## Technische Herausforderungen gemeistert

### 1. Skalierung
- **Problem:** 600+ Videos parallel verarbeiten
- **Lösung:** Queue-System mit Rate Limiting für APIs

### 2. Mehrsprachigkeit
- **Problem:** Vorträge in EN, FR, NL, DE...
- **Lösung:** Whisper's automatische Spracherkennung

### 3. Technische Begriffe
- **Problem:** Fachbegriffe, Projekt-Namen, Akronyme
- **Lösung:** Custom Vocabulary für Whisper, GPT-4 Post-Processing

### 4. Qualitätssicherung
- **Problem:** Wie prüft man 600+ Transkripte?
- **Lösung:** Stichproben + Community Feedback Loop

## Das Template: FOSDEM Session

```markdown
---
template: fosdem_session.md
---

# {{title}}

**Speaker:** {{speaker}}
**Track:** {{track}}
**Duration:** {{duration}}
**Language:** {{language}}

## Summary
{{summary|Provide a concise summary focusing on technical innovations}}

## Key Takeaways
{{takeaways|List 3-5 main points for developers}}

## Technical Details
{{technical|Extract code examples, architectures, tools mentioned}}

## Resources
{{resources|List all mentioned projects, links, documentation}}

## Community Notes
{{community|Space for community additions and corrections}}
```

## Impact & Feedback

> "Was früher Monate gedauert hätte, war in 3 Tagen erledigt. Unglaublich!"
> — *FOSDEM Volunteer*

> "Endlich kann ich Vorträge nachlesen, die ich verpasst habe. Danke!"
> — *Community Member*

> "Die Durchsuchbarkeit ist ein Game Changer für unsere Recherche."
> — *Researcher*

## Lessons Learned

### Was gut lief
- ✅ Vollautomatisierung nach Initial-Setup
- ✅ Hohe Qualität der Transkripte
- ✅ Skalierung ohne Probleme
- ✅ Community-Begeisterung

### Verbesserungspotenzial
- 🔄 Noch bessere Speaker-Diarization
- 🔄 Live-Streaming Integration
- 🔄 Direkte PeerTube Integration
- 🔄 Multilingual Summaries

## Reproduzierbar für andere Konferenzen

Das Setup ist vollständig dokumentiert und kann für andere Konferenzen genutzt werden:

1. **Template anpassen** für Konferenz-Stil
2. **Video-Sources konfigurieren** (YouTube, Vimeo, etc.)
3. **Processing starten** - der Rest läuft automatisch
4. **Knowledge Scout** für Organisation und Zugriff

## Code & Konfiguration

Die komplette Pipeline ist Open Source:

```bash
# FOSDEM Processing Pipeline
git clone https://github.com/bCommonsLAB/conference-pipeline
cd conference-pipeline
cp configs/fosdem.yaml config.yaml
python process.py --conference fosdem2025
```

## Nächste Schritte

- **FOSDEM 2026** bereits in Planung
- **Real-time Processing** während der Konferenz
- **Integration mit Conference Apps**
- **Föderierte Suche** über mehrere Konferenzen

---

<div style="background: #f0f9ff; padding: 20px; border-radius: 10px; margin: 30px 0;">
<h3>🚀 Willst du das für deine Konferenz?</h3>
<p>Die Tools sind Open Source und bereit für dein Event!</p>
<a href="../../04-connect/index.md">→ Kontaktiere mich</a>
</div>

[← Zurück zu den Erfolgsgeschichten](./index.md)
