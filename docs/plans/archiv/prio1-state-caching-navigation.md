---
description: 
globs: 
alwaysApply: false
---
**Kontext:**
Stabiles und konsistentes State Management ist die Basis für alle weiteren Features. Caching und Navigation müssen performant und fehlerfrei funktionieren.

**Zu überarbeiten:**
- Atoms und Contexts konsolidieren, eindeutige Benennung, keine doppelten States
- Persistenzstrategie für Atoms festlegen (z.B. lokale Speicherung, Initialisierung)
- Caching-Strategie für FileTree und FilePreview implementieren
- Breadcrumb-Logik zentralisieren und vereinfachen

**Hinweise:**
- Keine breaking changes für bestehende Kernfunktionen!
- Alle Änderungen dokumentieren

