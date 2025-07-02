# PowerPoint Präsentationsmaterialien

Dieses Verzeichnis enthält alle Materialien für die Knowledge Scout Präsentation.

## 📁 Dateien

### `knowledge-scout-presentation.md`
**Hauptpräsentation** mit 15 Folien als Markdown
- Vollständige Projektvorstellung
- Technische Details und Features
- Business-Nutzen und ROI
- Demo-Vorbereitung
- Q&A und Next Steps

### `presentation-notes.md`
**Präsentationsnotizen** für Sprecher (45-60 Min Version)
- Folie-spezifische Sprecher-Notizen
- Demo-Checkliste und -Script
- Q&A-Vorbereitung
- Technische Setup-Tipps
- Follow-up Aktionen

### `knowledge-scout-presentation-10min.md`
**Ultra-Kompakte 10-Minuten-Präsentation**
- 6 fokussierte Folien
- Prägnante Problem-Lösung-Demo-Struktur
- Für schnelle Entscheidungen optimiert
- Maximaler Impact in minimaler Zeit

### `presentation-notes-10min.md`
**Präsentationsnotizen für 10-Minuten-Version**
- Exaktes Timing pro Folie
- Sekundengenauer Sprechtext
- Notfall-Strategien für Zeitdruck
- Zielgruppen-Anpassung

## 🔄 Markdown zu PowerPoint konvertieren

### Option 1: Marp (Empfohlen)
```bash
# Marp installieren
npm install -g @marp-team/marp-cli

# Zu PowerPoint konvertieren
marp knowledge-scout-presentation.md --output knowledge-scout.pptx

# Zu PDF konvertieren
marp knowledge-scout-presentation.md --pdf
```

### Option 2: Pandoc
```bash
# Pandoc installieren (macOS)
brew install pandoc

# Zu PowerPoint konvertieren
pandoc knowledge-scout-presentation.md -o knowledge-scout.pptx

# Mit Custom Template
pandoc knowledge-scout-presentation.md -o knowledge-scout.pptx --reference-doc=template.pptx
```

### Option 3: Online Tools
- **GitPitch**: Web-basierte Präsentationen
- **Slidev**: Vue.js-basierte Slides
- **Reveal.js**: HTML-Präsentationen

## 🎨 Design-Anpassungen

### Farbschema
```css
:root {
  --primary-color: #0070f3;    /* Next.js Blau */
  --secondary-color: #7928ca;  /* Vercel Violett */
  --accent-color: #f81ce5;     /* Pink für Highlights */
  --text-color: #333333;       /* Dunkelgrau */
  --bg-color: #fafafa;         /* Hellgrau */
}
```

### Logo und Branding
- Knowledge Scout Logo in `src/components/icons.tsx`
- Corporate Design anpassbar über Tailwind Config
- Custom Fonts: Geist für Typografie

## 🎯 Zielgruppen-Anpassung

### Für Management (Executive Summary)
**Fokus-Folien:** 1, 2, 3, 6, 8, 12, 15
- Problem und Lösung
- Business-Nutzen
- ROI und Roadmap

### Für IT-Entscheider (Technical Overview)
**Fokus-Folien:** 4, 7, 9, 10, 11
- Architektur und Tech Stack
- Sicherheit und Compliance
- Integration und Skalierung

### Für Entwickler (Deep Dive)
**Fokus-Folien:** 4, 7, 9, 10, 11, 13
- Code-Architektur
- API-Design
- Entwickler-Tools
- Live Demo

## 📊 Präsentations-Varianten

### Ultra-Kurze Version (10 Min) ⚡
**Folien:** 6 fokussierte Slides
- Problem → Lösung → Demo → Call-to-Action
- Maximaler Impact, minimale Zeit
- Für schnelle Entscheidungen
- **Datei:** `knowledge-scout-presentation-10min.md`

### Kurze Version (20 Min)
**Folien:** 1, 2, 3, 6, 8, 13, 15
- Schneller Überblick
- Fokus auf Business-Value
- Kurze Demo
- Next Steps

### Standard Version (45 Min)
**Folien:** 1-8, 11-15
- Vollständige Funktions-Übersicht
- Technische Details
- Ausführliche Demo
- Q&A Session

### Technische Deep Dive (90 Min)
**Alle Folien:** 1-15 + Anhang
- Vollständige technische Präsentation
- Code-Walkthrough
- Architektur-Diskussion
- Workshop-Charakter

## 🚀 Demo-Vorbereitung

### Lokale Umgebung
```bash
# Entwicklungsserver starten
pnpm dev

# Test-Daten vorbereiten
npm run seed-demo-data

# Demo-Bibliothek erstellen
curl -X POST localhost:3000/api/libraries \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Library","provider":"filesystem"}'
```

### Backup-Plan
1. **Screenshots** aller wichtigen UI-Bereiche
2. **Video-Recording** der Standard-Workflows
3. **Static Export** für Offline-Demo
4. **Lokale Testdaten** ohne Internet-Abhängigkeit

## 📋 Checkliste vor Präsentation

### Technisch
- [ ] Demo-Umgebung getestet
- [ ] Internet-Verbindung stabil
- [ ] Browser-Kompatibilität geprüft
- [ ] Backup-Material bereit

### Inhalt
- [ ] Zielgruppe analysiert
- [ ] Folien angepasst
- [ ] Timing geprüft
- [ ] Q&A vorbereitet

### Materialien
- [ ] Präsentation exportiert
- [ ] Handouts gedruckt
- [ ] Demo-Setup dokumentiert
- [ ] Kontakt-Info aktuell

## 🔗 Weiterführende Links

- [Marp Documentation](https://marp.app/)
- [Pandoc User Guide](https://pandoc.org/MANUAL.html)
- [Reveal.js Documentation](https://revealjs.com/)
- [Knowledge Scout Docs](../README.md)

## 📝 Feedback und Verbesserungen

Nach der Präsentation:
1. **Feedback sammeln** und dokumentieren
2. **Folien aktualisieren** basierend auf Rückmeldungen
3. **Demo optimieren** für nächste Präsentation
4. **Neue Fragen** in Q&A-Sammlung aufnehmen

---

**Viel Erfolg bei der Präsentation! 🎯** 