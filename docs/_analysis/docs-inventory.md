---
title: Docs-Inventar & Nachverfolgung
---

Hinweis: Dieses Inventar dient der Nachverfolgung der Migration. Quelle: `docs/`.

| Datei | H1 (erster Heading) | Vorschlag Kategorie | Ziel-Pfad (neu) | Status | Notizen |
| --- | --- | --- | --- | --- | --- |
| 01_project_overview.md | Projektübersicht | overview | overview/intro.md | migrated | In neue Intro-Seite überführt |
| 02_architecture.md | Technische Architektur | architecture | architecture/architecture.md | migrated | Inhalt wird später konsolidiert |
| 03_core_components.md | Kernkomponenten | architecture | architecture/core-components.md | migrated | Zusammengefasst |
| 04_storage-provider.md | Storage Provider System | concepts | concepts/storage-provider.md | migrated | Archiviert als `_archive/04_storage-provider.md` |
| 05-features-transformation-service.md | Transformation Service Integration | concepts | concepts/features/transformation-service.md | migrated | Implementierung: teilweise (YouTube-Endpunkt fehlt), Archiviert als `_archive/05-features-transformation-service.md` |
| 05_feature-shadowtwins.md | Shadow-Twin Feature | concepts | concepts/features/shadowtwins.md | migrated | Archiviert als `_archive/05_feature-shadowtwins.md` |
| 05_features.md | Funktionen und Benutzergruppen | overview | overview/features.md | migrated | Archiviert als `_archive/05_features.md` |
| 06_setup.md | Entwickler Setup Guide | guide | guide/setup.md | migrated | Konsolidierung in Guide folgt |
| 07_api.md | API Dokumentation | reference | reference/api/overview.md | migrated | Archiviert als `_archive/07_api.md` |
| 08_settings.md | Einstellungen (Settings) | guide | guide/settings.md | migrated | Archiviert als `_archive/08_settings.md` |
| batch-session-import.md | Batch Session Import | guide | guide/batch-session-import.md | migrated | Zusammengefasst |
| CommonSecretaryServicesAPI.md | Common Secretary Services API | reference | reference/api/secretary-services.md | migrated | Externe API |
| docker-deployment.md |  | ops | ops/deployment/docker.md | pending |  |
| electron-package-strategy.md |  | ops | ops/desktop/package-strategy.md | pending |  |
| electron-quick-setup.md |  | ops | ops/desktop/quick-setup.md | pending |  |
| event-monitor-integration.md | Event-Monitor Integration | guide | guide/event-monitor.md | migrated | Implementiert (UI + API vorhanden) |
| extendet-shadowTwin-feature.md | Extended Shadow-Twin | concepts | concepts/features/extended-shadowtwin.md | migrated | Konzept |
| image-transformation.md | Bild-Transformation mit OCR | concepts | concepts/image-transformation.md | migrated | Implementiert (API/Komponenten vorhanden) |
| library_components.md | Library Components | concepts | concepts/library/components.md | migrated | Zusammengefasst |
| localstorage.md | FileSystem Storage Provider | concepts | concepts/localstorage.md | migrated | Implementiert (Provider/Client vorhanden), Archiviert als `_archive/localstorage.md` |
| mainConcept.md | Hauptkonzept und Architektur | overview | overview/main-concept.md | migrated | Archiviert als `_archive/mainConcept.md` |
| metadata-concept.md | Metadaten-Konzept | concepts | concepts/metadata.md | migrated | Zusammengefasst |
| pdf-extraction-methods.md | PDF-Extraktionsmethoden | concepts | concepts/pdf/extraction-methods.md | migrated | Implementiert (Optionen aktiv) |
| pdf-image-extraction-test-plan.md | PDF-Bilderspeicherung Test-Plan | guide | guide/pdf/image-extraction-test-plan.md | migrated | Implementiert & getestet |
| pdf-image-extraction-testing-guide.md | PDF-Bilderspeicherung Test-Anleitung | guide | guide/pdf/image-extraction-testing-guide.md | migrated | Implementiert |
| todo-list-export.md | TODO-Listen Export (Historie) | history | history/todo-list-export.md | migrated | Historie |
| track-processor-api.md | Track-Processor API | reference | reference/api/track-processor.md | migrated | Externer Service/Konzept |
| videotransformer.md | Video-Transformation | concepts | concepts/video-transformation.md | migrated | Konzept |
| history/* |  | history | history/* | pending | bleibt im Ordner, ggf. Indexseite |
| library_concept/* |  | concepts | concepts/library/* | pending | aufteilen nach Themen |
| powerpoint/* |  | presentations | presentations/* | pending | ggf. Links korrigieren |
| logs/* |  | archive | _archive/logs/* | pending | nicht veröffentlichen? |

Arbeitsweise:
- Spalte „H1“ beim Abarbeiten füllen (erste Überschrift aus Datei).
- Statusfluss: pending → planned → migrated → archived (oder dropped mit Grund).
- Nach Migration: Ursprungsdatei nach `docs/_archive/` verschieben, Inventar aktualisieren.


