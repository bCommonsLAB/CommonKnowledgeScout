# Verfeinerung der PDF-Transformation und Metadaten
_Exported on 10/9/2025 at 14:57:54 GMT+2 from Cursor (1.7.38)_

---

**User**

ei dieser pdf Verarbeitung, Transformation möchte ich den ersten Schritt, das pdf in valides Markdown zu transformieren, möchte ich verfeinern. Momentan läuft es alles in einem Batch durch und als Ergebnis bekommt man ein Markdown vom gesamten pdf, auch wenn im Hintergrund die einzelnen Seiten verarbeitet werden. Und es stellt sich heraus, dass man Seite für Seite prüften muss. Deswegen will ich den Prozess gerne verfeinern. Also wenn ich ein pdf verarbeite, möchte ich gerne auswählen, ob ich eine Seitenplazierte oder Methode anwende. Wobei das eigentlich immer sein sollte. Aber wie man Schritt für Schritt vorgehen möchte. Eines ist eben diese automatische, alle Seiten verarbeiten, alle Seiten transformieren. Aber es gibt Fälle, wo man seitenspezifisch das machen muss. Das heißt, ich würde gerne in einem ersten Schritt einfach nur alle Seiten als Bilder transformieren, also extrahieren. Dann diese werden ja eh schon in einem Unterverzeichnis dann organisiert. Aber jetzt bräuchte ich einen Editor, wo ich dann Seite für Seite durchgehe und genauer kontrolliere, was er jetzt transformiert hat und eventuell unterschiedliche Verfahren dann anwende. Es kann sein, dass eine Seite nur Text enthält. Da würde vielleicht die einfache OCR-Methode funktionieren, die kostengünstig ist und schnell. Aber dann gibt es Seiten, die mehr Bilder haben oder mehr Spalten haben. Da ist dann diese LLM-basierte Konvertierung wichtig. Aber dann gibt es auch sehr komplexe Seiten, die man vielleicht zuerst noch so schneiden muss, in mehrere Unterbereiche, um sie zu verarbeiten. Zum Beispiel so Posters oder da ist das LLM überfordert. Auf alle Fälle müssen wir diesen Prozess
genauer durchgehen. Und neben der reinen Marktanerkennung gibt es da eben diese Metadaten, die, ich müsste eigentlich immer wissen, in einem Werk, welche Seite es sich handelt, also die Seitennummer und zu welchem Kapitel der Text gerade gehört. Und es ist so, dass man das Buch von vorne nach hinten verarbeitet. Und wenn eine Seite jetzt ein Inhaltsverzeichnis enthält, dann sollte man dieses Inhaltsverzeichnis in den Metadaten mitführen. Das heißt, die Folgeseiten bekommen in ihrem Kontext immer auch die Metadaten der vorherigen Seiten. So können sich die Metadaten kumulativ verfeinern. Neben der Kapitelzuordnung wäre auch eine Zuordnung zu einem Autor. Es gibt Werke mit mehreren Autoren. Oder auch eine Lokalisierung. Also in welchem Ort oder welcher Gegend behandelt der Text. Autor, Ort, Datum, Erscheinungsjahr, Quelle, vielleicht ist es eine Zeitschrift mit unterschiedlichen Inhalten. Diese Metadaten möchte ich erfassen. Und wenn wir da jede Seite erfasst haben, am Ende und abgenommen haben, gibt es dann einen Prozess, dass das Gesamtdokument dann aus diesen Einzelseiten generiert und so ein valides Dokument macht.

Ich habe jetzt in dem Secretary Service aber eine neue LLM-basierte PDF-Transformation ergänzt mit dem Nomen Mistral-OCR, die ein verändertes Verfahren von Mistral verwendet. Das heißt, ich sende ein komplettes PDF auf hunderte Seiten und ich bekomme als Antwort eine Struktur, die ungefähr so aussieht. Ich möchte jetzt diese alternative Transformation-Methode in unseren PDF-Transformer einbauen und so diese Ingestion Pipeline nochmal testen. 

Vielleicht können wir damit dann diese Seitenweise-Verarbeitung uns sparen, oder höchstens noch nur so eine Prüfansicht bauen, die auf der linken Seite das PDF zeigt und rechts den Text. Aber das schauen wir später. Zuerst schauen wir, ob wir dieses Verfahren anwenden können.@transform-save-options.tsx @client.ts 

{
  "status": "success",
  "request": {
    "processor": "pdf",
    "timestamp": "2025-09-05T17:22:55.270919",
    "parameters": {
      "file_path": "C:\\Users\\peter.aichner\\projects\\CommonSecretaryServices\\cache\\uploads\\upload_2440dbd9-7e60-4836-95f1-73b164e49f22.pdf",
      "template": null,
      "context": null,
      "extraction_method": "mistral_ocr"
    }
  },
  "process": {
    "id": "job-17e6970e-1da0-4dc2-9435-a02e5deda468",
    "main_processor": "PDFProcessor",
    "started": "2025-09-05T17:22:46.355777",
    "sub_processors": [
      "TransformerProcessor"
    ],
    "completed": null,
    "duration": null,
    "is_from_cache": false,
    "cache_key": "9325040f38c074229683c179d8bcb4cec68cd8b1fa5b420278102bde282df3ee",
    "llm_info": {
      "requests": [],
      "requests_count": 0,
      "total_tokens": 0,
      "total_duration": 0
    }
  },
  "error": null,
  "data": {
    "metadata": {
      "file_name": "upload_2440dbd9-7e60-4836-95f1-73b164e49f22.pdf",
      "file_size": 3445102,
      "page_count": 32,
      "format": "pdf",
      "process_dir": "cache\\pdf\\temp\\pdf\\6f85942558c3953f",
      "image_paths": [],
      "preview_paths": [],
      "preview_zip": null,
      "text_paths": [],
      "original_text_paths": [],
      "text_contents": [],
      "extraction_method": "mistral_ocr"
    },
    "extracted_text": "--- Seite 1 ---\n# Unter der Lupe Die \n\n## ![img-0.jpeg](img-0.jpeg)\n\n## ![img-1.jpeg](img-1.jpeg)\n\n--- Seite 2 ---\n## Vorwort\n\nBergwiesen sind etwas ganz Besonderes. Dem Zauber ihrer bunten Blütenpracht mit den vielen Schmetterlingen kann sich wohl kaum jemand entziehen. Aber die Bergwiesen sind nicht nur schön anzuschauen: Für zahlreiche Tier-\nund Pflanzenarten sind diese naturbelassenen Wiesen von größter ökologischer Bedeutung. Braunkehlchen, Neuntöter oder Feldlerchen - ansonsten in ihren Beständen eher rückläufig finden hier eine ideale ökologische Nische.\n\nDie Bergwiesen sind keine Naturlandschaft, sondern\nvom Menschen geschaffene Kulturlandschaft. Durch Rodungen gewonnene, große Weideflächen haben im Lauf der Jahrhunderte einen einzigartigen Landschaftstypus entstehen lassen. Häufig sind die Bergwiesen von Hecken umgeben. Auch diese sind ökologisch wichtig und landschaft-\nlich enorm reizvoll. Gleichzeitig sind sie aber auch stumme Zeugen der engen Verbindung von Mensch und Berg in unserem Land.\n\n## Der Landesrat\n\nDr. Michl Laimer",
    "ocr_text": null,
    "process_id": "job-17e6970e-1da0-4dc2-9435-a02e5deda468",
    "processed_at": "2025-09-05T15:22:55.269920+00:00",
    "mistral_ocr_raw": {
      "pages": [
        {
          "index": 0,
          "markdown": "# Unter der Lupe Die \n\n## ![img-0.jpeg](img-0.jpeg)\n\n## ![img-1.jpeg](img-1.jpeg)",
          "images": [
            {
              "id": "img-0.jpeg",
              "top_left_x": 0,
              "top_left_y": 1880,
              "bottom_right_x": 239,
              "bottom_right_y": 2041,
              "image_base64": null,
              "image_annotation": null
            },
            {
              "id": "img-1.jpeg",
              "top_left_x": 0,
              "top_left_y": 2055,
              "bottom_right_x": 239,
              "bottom_right_y": 2261,
              "image_base64": null,
              "image_annotation": null
            }
          ],
          "dimensions": {
            "dpi": 200,
            "height": 2339,
            "width": 1653
          }
        },
        {
          "index": 1,
          "markdown": "## Vorwort\n\nBergwiesen sind etwas ganz Besonderes. Dem Zauber ihrer bunten Blütenpracht mit den vielen Schmetterlingen kann sich wohl kaum jemand entziehen. Aber die Bergwiesen sind nicht nur schön anzuschauen: Für zahlreiche Tier-\nund Pflanzenarten sind diese naturbelassenen Wiesen von größter ökologischer Bedeutung. Braunkehlchen, Neuntöter oder Feldlerchen - ansonsten in ihren Beständen eher rückläufig finden hier eine ideale ökologische Nische.\n\nDie Bergwiesen sind keine Naturlandschaft, sondern\nvom Menschen geschaffene Kulturlandschaft. Durch Rodungen gewonnene, große Weideflächen haben im Lauf der Jahrhunderte einen einzigartigen Landschaftstypus entstehen lassen. Häufig sind die Bergwiesen von Hecken umgeben. Auch diese sind ökologisch wichtig und landschaft-\nlich enorm reizvoll. Gleichzeitig sind sie aber auch stumme Zeugen der engen Verbindung von Mensch und Berg in unserem Land.\n\n## Der Landesrat\n\nDr. Michl Laimer",
          "images": [],
          "dimensions": {
            "dpi": 200,
            "height": 2339,
            "width": 1653
          }
        },
        {
          "index": 2,
          "markdown": ".",
          "images": [],
          "dimensions": {
            "dpi": 200,
            "height": 2339,
            "width": 1653
          }
        }
  }
}


---

**Cursor**

Ich starte mit einer gezielten Suche nach der PDF-API-Route und relevanten Stellen, um die neue Methode "mistral_ocr" sauber zu integrieren und die Typen anzupassen. Danach füge ich die Option im UI hinzu und erweitere das Response-Interface.

Ich öffne die relevanten Server- und UI-Dateien parallel, um die PDF-Route, vorhandene Extraktionsmethoden und den Datenfluss zu prüfen, bevor ich die neue Methode „mistral_ocr“ integriere.

Ich ergänze jetzt die neue Extraktionsmethode im UI (`transform-save-options.tsx`) und erweitere die Sekretär-Response-Typen (`client.ts`) um das neue `mistral_ocr_raw`-Feld, damit die Antwort korrekt typisiert ist. Danach prüfe ich Linter-Fehler.

```typescriptreact
*** Begin Patch
*** Update File: src/components/library/transform-save-options.tsx
@@
               <SelectContent>
                 <SelectItem value="native">Native Analyse</SelectItem>
                 <SelectItem value="ocr">Tesseract OCR</SelectItem>
                 <SelectItem value="both">OCR + Native</SelectItem>
                 <SelectItem value="preview">Vorschaubilder</SelectItem>
                 <SelectItem value="preview_and_native">Vorschaubilder + Native</SelectItem>
                 <SelectItem value="llm">LLM-basierte OCR</SelectItem>
                 <SelectItem value="llm_and_ocr">LLM + OCR</SelectItem>
+                <SelectItem value="mistral_ocr">Mistral OCR (LLM)</SelectItem>
               </SelectContent>
               </Select>
               <p className="text-xs text-muted-foreground mt-1">
-                Bestimmt, wie der Inhalt aus der PDF extrahiert wird. Native = Text-Extraktion, OCR = Bild-zu-Text, LLM = KI-basierte Analyse
+                Bestimmt, wie der Inhalt aus der PDF extrahiert wird. Native = Text-Extraktion, OCR = Bild-zu-Text, LLM/Mistral = KI-basierte Analyse
               </p>
             </div>
           )}
*** End Patch
```

Ich füge die neue Option in der Auswahl der Extraktionsmethoden hinzu und erweitere die Typen. Danach prüfe ich kurz die Datei erneut, um die Einfügestelle exakt zu treffen.

```typescriptreact
"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { SUPPORTED_LANGUAGES } from "@/lib/secretary/constants";

export interface TransformSaveOptions {
  [key: string]: unknown;
  targetLanguage: string;
  fileName: string;
  createShadowTwin: boolean;
  fileExtension: string;
  extractionMethod?: string; // Optional für PDF-Transformation
  useCache?: boolean; // Neu: Cache-Option für alle Transformationen
  includeImages?: boolean; // Neu: Bilder mit extrahieren und speichern
  context?: string; // Optionaler Kontext für LLM-Optimierung
}

interface TransformSaveOptionsProps {
  originalFileName: string;
  onOptionsChangeAction: (options: TransformSaveOptions) => void;
  defaultLanguage?: string;
  supportedLanguages?: Array<{ value: string; label: string }>;
  defaultExtension?: string;
  className?: string;
  showExtractionMethod?: boolean; // Neu: Zeigt Extraktionsmethode für PDFs
  defaultExtractionMethod?: string; // Neu: Standard-Extraktionsmethode
  showUseCache?: boolean; // Neu: Zeigt Cache-Option
  defaultUseCache?: boolean; // Neu: Standard-Cache-Einstellung
  showIncludeImages?: boolean; // Neu: Zeigt Bilder-Option
  defaultIncludeImages?: boolean; // Neu: Standard-Bilder-Einstellung
  showCreateShadowTwin?: boolean; // Neu: Checkbox für Shadow-Twin ein-/ausblenden
}

export function TransformSaveOptions({
  originalFileName,
  onOptionsChangeAction,
  defaultLanguage = "de",
  supportedLanguages = SUPPORTED_LANGUAGES.map(lang => ({ value: lang.code, label: lang.name })),
  defaultExtension = "md",
  className,
  showExtractionMethod = false,
  defaultExtractionMethod = "native",
  showUseCache = false,
  defaultUseCache = false,
  showIncludeImages = false,
  defaultIncludeImages = false,
  showCreateShadowTwin = true
}: TransformSaveOptionsProps) {
  // Hilfsfunktion zum Extrahieren des Basisnamens ohne Erweiterung
  function getBaseFileName(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? fileName : fileName.substring(0, lastDotIndex);
  }

  // Generiere Shadow-Twin Dateinamen nach Konvention: {originalname}.{targetLanguage}.md
  function generateShadowTwinName(baseName: string, targetLanguage: string): string {
    return `${baseName}.${targetLanguage}`;
  }

  const [options, setOptions] = React.useState<TransformSaveOptions>(() => {
    const baseName = getBaseFileName(originalFileName);
    return {
      targetLanguage: defaultLanguage,
      fileName: generateShadowTwinName(baseName, defaultLanguage),
      createShadowTwin: true,
      fileExtension: defaultExtension,
      extractionMethod: defaultExtractionMethod,
      useCache: defaultUseCache,
      includeImages: defaultIncludeImages
    };
  });

  // Aktualisiert die Optionen und informiert den übergeordneten Component
  const updateOptions = React.useCallback((newOptions: Partial<TransformSaveOptions>) => {
    setOptions(prev => {
      const updated = { ...prev, ...newOptions };
      
      // Wenn sich die Zielsprache ändert und Shadow-Twin aktiviert ist, 
      // aktualisiere den Dateinamen entsprechend
      if (newOptions.targetLanguage && updated.createShadowTwin) {
        const baseName = getBaseFileName(originalFileName);
        updated.fileName = generateShadowTwinName(baseName, newOptions.targetLanguage);
      }
      
      // Wenn Shadow-Twin aktiviert wird, generiere den korrekten Namen
      if (newOptions.createShadowTwin === true) {
        const baseName = getBaseFileName(originalFileName);
        updated.fileName = generateShadowTwinName(baseName, updated.targetLanguage);
      }
      
      onOptionsChangeAction(updated);
      return updated;
    });
  }, [onOptionsChangeAction, originalFileName]);

  // Effekt, um die Optionen bei Änderung des Originalnamens zu aktualisieren
  React.useEffect(() => {
    const baseName = getBaseFileName(originalFileName);
    const expectedFileName = options.createShadowTwin 
      ? generateShadowTwinName(baseName, options.targetLanguage)
      : baseName;
      
    if (expectedFileName !== options.fileName) {
      // Verzögere das Update auf den nächsten Tick, um den Rendering-Zyklus zu verlassen
      const timer = setTimeout(() => {
        updateOptions({ fileName: expectedFileName });
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [originalFileName, options.targetLanguage, options.createShadowTwin, updateOptions, options.fileName]);

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="target-language">Zielsprache</Label>
              <Select
                value={options.targetLanguage}
                onValueChange={(value) => updateOptions({ targetLanguage: value })}
              >
                <SelectTrigger id="target-language">
                  <SelectValue placeholder="Sprache auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {supportedLanguages.map(lang => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="file-extension">Dateierweiterung</Label>
              <Select
                value={options.fileExtension}
                onValueChange={(value) => updateOptions({ fileExtension: value })}
                disabled={options.createShadowTwin} // Deaktiviert wenn Shadow-Twin
              >
                <SelectTrigger id="file-extension">
                  <SelectValue placeholder="Erweiterung wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="txt">Text (.txt)</SelectItem>
                  <SelectItem value="json">JSON (.json)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showExtractionMethod && (
            <div>
              <Label htmlFor="extraction-method">Extraktionsmethode</Label>
              <Select
                value={options.extractionMethod || defaultExtractionMethod}
                onValueChange={(value) => updateOptions({ extractionMethod: value })}
              >
                <SelectTrigger id="extraction-method">
                  <SelectValue placeholder="Methode auswählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">Native Analyse</SelectItem>
                  <SelectItem value="ocr">Tesseract OCR</SelectItem>
                  <SelectItem value="both">OCR + Native</SelectItem>
                  <SelectItem value="preview">Vorschaubilder</SelectItem>
                  <SelectItem value="preview_and_native">Vorschaubilder + Native</SelectItem>
                  <SelectItem value="llm">LLM-basierte OCR</SelectItem>
                  <SelectItem value="llm_and_ocr">LLM + OCR</SelectItem>
                  <SelectItem value="mistral_ocr">Mistral OCR (LLM)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Bestimmt, wie der Inhalt aus der PDF extrahiert wird. Native = Text-Extraktion, OCR = Bild-zu-Text, LLM/Mistral = KI-basierte Analyse
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="file-name">Dateiname</Label>
            <Input
              id="file-name"
              value={options.fileName}
              onChange={(e) => updateOptions({ fileName: e.target.value })}
              disabled={options.createShadowTwin} // Deaktiviert wenn Shadow-Twin
              placeholder={options.createShadowTwin ? "Automatisch generiert" : "Dateiname eingeben"}
            />
            {options.createShadowTwin && (
              <p className="text-xs text-muted-foreground mt-1">
                Shadow-Twin Format: {getBaseFileName(originalFileName)}.{options.targetLanguage}.md
              </p>
            )}
          </div>

          {showCreateShadowTwin && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="create-shadow-twin"
                checked={options.createShadowTwin}
                onCheckedChange={(checked) => updateOptions({ createShadowTwin: !!checked })}
              />
              <Label htmlFor="create-shadow-twin">Als Shadow-Twin speichern</Label>
            </div>
          )}

          {showUseCache && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-cache"
                checked={options.useCache || false}
                onCheckedChange={(checked) => updateOptions({ useCache: !!checked })}
              />
              <Label htmlFor="use-cache">Cache verwenden</Label>
              <p className="text-xs text-muted-foreground ml-6">
                Beschleunigt die Verarbeitung durch Wiederverwendung vorheriger Ergebnisse
              </p>
            </div>
          )}

          {showIncludeImages && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-images"
                checked={options.includeImages || false}
                onCheckedChange={(checked) => updateOptions({ includeImages: !!checked })}
              />
              <Label htmlFor="include-images">Bilder mit extrahieren</Label>
              <p className="text-xs text-muted-foreground ml-6">
                Speichert zusätzlich alle PDF-Seiten als Bilder für Qualitätskontrolle
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 
```

Ich erweitere jetzt die Typen in `src/lib/secretary/client.ts`, um das neue Feld `mistral_ocr_raw` mitsamt strukturierten Page- und Image-Infos aufzunehmen, und prüfe anschließend den Linter.

```typescript
import { 
  TemplateExtractionResponse 
} from './types';

export class SecretaryServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretaryServiceError';
  }
}

/**
 * Typ für die Secretary Service Audio Response
 */
export interface SecretaryAudioResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      audio_source: string;
      source_info: {
        original_filename: string;
        file_size: number;
        file_type: string;
        file_ext: string;
      };
      source_language: string;
      target_language: string;
      template: string;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
    metadata?: {
      title: string;
      duration: number;
      format: string;
      channels: number;
      sample_rate: number;
      bit_rate: number;
      process_dir: string;
      chapters: unknown[];
    };
    process_id: string;
    transformation_result: unknown | null;
    status: string;
  };
}

/**
 * Typ für die Secretary Service Video Response
 */
export interface SecretaryVideoResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      source_language: string;
      target_language: string;
      template: string | null;
      use_cache: boolean;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    metadata: {
      title: string;
      source: {
        url: string | null;
        file_name: string;
        file_size: number;
        upload_timestamp: string;
      };
      duration: number;
      duration_formatted: string;
      file_size: number;
      process_dir: string;
      audio_file: string;
      video_id: string | null;
    };
    process_id: string;
    audio_result: unknown | null;
    transcription: {
      text: string;
      source_language: string;
      segments: unknown[];
    };
  };
}

/**
 * Typ für die Secretary Service PDF Response
 */
export interface SecretaryPdfResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;  // ← Geändert von text_content zu extracted_text
    ocr_text: string | null;
    metadata: {
      file_name: string;
      file_size: number;
      page_count: number;
      format: string;
      process_dir: string;
      image_paths: string[];
      preview_paths: string[];
      preview_zip: string | null;
      text_paths: string[];
      original_text_paths: string[];
      text_contents: Array<{
        page: number;
        content: string;
      }>;
      extraction_method: string;
    };
    process_id: string;
    processed_at: string;
    // Neu: Link statt großer Base64-Blobs
    images_archive_url?: string;
    // Alt (deprecated): verbleibt für Abwärtskompatibilität
    images_archive_data?: string; 
    images_archive_filename?: string; 
    // Neu: Rohdaten der Mistral-OCR-Ausgabe mit Seitenstruktur
    mistral_ocr_raw?: {
      pages: Array<{
        index: number;
        markdown: string;
        images: Array<{
          id: string;
          top_left_x: number;
          top_left_y: number;
          bottom_right_x: number;
          bottom_right_y: number;
          image_base64: string | null;
          image_annotation: string | null;
        }>;
        dimensions: {
          dpi: number;
          height: number;
          width: number;
        };
      }>;
    };
  };
}

/**
 * Transformiert eine Audio-Datei mithilfe des Secretary Services in Text
 * 
 * @param file Die zu transformierende Audio-Datei 
 * @param targetLanguage Die Zielsprache für die Transkription
 * @param libraryId ID der aktiven Bibliothek
 * @param useCache Cache verwenden (Standard: true)
 * @returns Die vollständige Response vom Secretary Service oder nur den Text (für Abwärtskompatibilität)
 */
export async function transformAudio(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  useCache: boolean = true
): Promise<SecretaryAudioResponse | string> {
  try {
    console.log('[secretary/client] transformAudio aufgerufen mit Sprache:', targetLanguage, 'und useCache:', useCache);
    
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('useCache', useCache.toString());
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-audio', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    // Die API Route sollte bereits die vollständige Response vom Secretary Service durchreichen
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Audio-Datei');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Name
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template-Name für die Transformation
 * @returns Den transformierten Text
 */
export async function transformText(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "Besprechung"
): Promise<string> {
  try {
    console.log('[secretary/client] transformText aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Text-Vorschau:', textContent?.substring(0, 100) || 'KEIN TEXT');
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('template', template);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      template: formData.get('template')
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Daten erfolgreich empfangen');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Texttransformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes');
  }
}

/**
 * Transformiert einen Text mithilfe des Secretary Services mit Template-Inhalt
 * 
 * @param textContent Der zu transformierende Text
 * @param targetLanguage Die Zielsprache für die Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @param templateContent Template-Inhalt für die Transformation
 * @returns Den transformierten Text
 */
export async function transformTextWithTemplate(
  textContent: string,
  targetLanguage: string,
  libraryId: string,
  templateContent: string
): Promise<string> {
  try {
    console.log('[secretary/client] transformTextWithTemplate aufgerufen mit Template-Content');
    console.log('[secretary/client] Text-Länge:', textContent?.length || 0);
    console.log('[secretary/client] Template-Content-Länge:', templateContent?.length || 0);
    
    if (!textContent || textContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Text zum Transformieren vorhanden');
    }
    
    if (!templateContent || templateContent.trim().length === 0) {
      throw new SecretaryServiceError('Kein Template-Content vorhanden');
    }
    
    const formData = new FormData();
    formData.append('text', textContent);
    formData.append('targetLanguage', targetLanguage);
    formData.append('templateContent', templateContent);
    
    // Debug: FormData-Inhalt prüfen
    console.log('[secretary/client] FormData erstellt mit:', {
      text: formData.get('text') ? 'vorhanden' : 'fehlt',
      targetLanguage: formData.get('targetLanguage'),
      templateContent: formData.get('templateContent') ? 'vorhanden' : 'fehlt'
    });
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API mit Template-Content');
    const response = await fetch('/api/secretary/process-text', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Template-Content-Transformation erfolgreich');
    return data.text;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Template-Content-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung des Textes mit Template-Content');
  }
}

/**
 * Erstellt eine Zusammenfassung für einen einzelnen Track
 * 
 * @param trackName Name des Tracks
 * @param targetLanguage Zielsprache für die Zusammenfassung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassung (Standard: "track_eco_social")
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit der Zusammenfassung
 */
export async function createTrackSummary(
  trackName: string,
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createTrackSummary aufgerufen für Track:', trackName, 'und Bibliothek:', libraryId);
    console.log('[secretary/client] Template:', template, 'Sprache:', targetLanguage);
    
    if (!trackName) {
      throw new SecretaryServiceError('Kein Track-Name angegeben');
    }
    
    if (!libraryId) {
      console.warn('[secretary/client] WARNUNG: Keine Bibliotheks-ID angegeben!');
    }
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    const requestBody = {
      template,
      target_language: targetLanguage,
      useCache
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API:', JSON.stringify(requestBody));
    const response = await fetch(`/api/secretary/tracks/${encodeURIComponent(trackName)}/summary`, {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify(requestBody)
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('[secretary/client] Antwort-Daten:', JSON.stringify(data).substring(0, 500) + '...');
    
    if (!response.ok) {
      // Detaillierte Fehlermeldung konstruieren
      let errorMsg = `Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`;
      if (data && data.error) {
        errorMsg += ` - ${data.error.code || ''}: ${data.error.message || 'Unbekannter Fehler'}`;
      }
      throw new SecretaryServiceError(errorMsg);
    }

    console.log('[secretary/client] Zusammenfassung erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung der Track-Zusammenfassung:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung der Track-Zusammenfassung');
  }
}

/**
 * Erstellt Zusammenfassungen für alle oder gefilterte Tracks
 * 
 * @param targetLanguage Zielsprache für die Zusammenfassungen
 * @param libraryId ID der aktiven Bibliothek
 * @param template Template für die Zusammenfassungen (Standard: "track_eco_social") 
 * @param useCache Cache verwenden (Standard: false)
 * @returns Die API-Antwort mit allen Zusammenfassungen
 */
export async function createAllTrackSummaries(
  targetLanguage: string,
  libraryId: string,
  template: string = "track_eco_social",
  useCache: boolean = false
): Promise<unknown> {
  try {
    console.log('[secretary/client] createAllTrackSummaries aufgerufen');
    
    // Angepasste Header für den Secretary Service
    const customHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Library-Id': libraryId
    };
    
    console.log('[secretary/client] Sende Anfrage an Secretary Track Processor API');
    const response = await fetch('/api/secretary/tracks/*/summarize_all', {
      method: 'POST',
      headers: customHeaders,
      body: JSON.stringify({
        template,
        target_language: targetLanguage,
        useCache
      })
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Alle Zusammenfassungen erfolgreich erstellt');
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Erstellung aller Track-Zusammenfassungen:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Erstellung aller Track-Zusammenfassungen');
  }
}

/**
 * Transformiert eine Video-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Video-Datei 
 * @param options Optionen für die Video-Transformation
 * @param libraryId ID der aktiven Bibliothek
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformVideo(
  file: File, 
  options: {
    extractAudio?: boolean;
    extractFrames?: boolean;
    frameInterval?: number;
    targetLanguage?: string;
    sourceLanguage?: string;
    template?: string;
  },
  libraryId: string
): Promise<SecretaryVideoResponse> {
  try {
    console.log('[secretary/client] transformVideo aufgerufen mit Optionen:', options);
    
    const formData = new FormData();
    formData.append('file', file);
    
    // Sprachoptionen
    if (options.targetLanguage) {
      formData.append('targetLanguage', options.targetLanguage);
    }
    
    if (options.sourceLanguage) {
      formData.append('sourceLanguage', options.sourceLanguage);
    }
    
    // Template-Option
    if (options.template) {
      formData.append('template', options.template);
    }
    
    // Video-spezifische Optionen
    if (options.extractAudio !== undefined) {
      formData.append('extractAudio', options.extractAudio.toString());
    }
    
    if (options.extractFrames !== undefined) {
      formData.append('extractFrames', options.extractFrames.toString());
    }
    
    if (options.frameInterval !== undefined) {
      formData.append('frameInterval', options.frameInterval.toString());
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-video', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Video-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryVideoResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Video-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Video-Datei');
  }
}

/**
 * Transformiert eine PDF-Datei mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende PDF-Datei 
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param template Optionales Template für die Verarbeitung
 * @param extractionMethod Die Extraktionsmethode (native, ocr, both, preview, preview_and_native, llm, llm_and_ocr)
 * @param useCache Ob Cache verwendet werden soll
 * @param includeImages Ob Bilder mit extrahiert werden sollen
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformPdf(
  file: File, 
  targetLanguage: string,
  libraryId: string,
  template?: string,
  extractionMethod: string = 'native',
  useCache: boolean = true,
  includeImages: boolean = false,
  useIngestionPipeline: boolean = false,
  context?: { originalItemId?: string; parentId?: string; originalFileName?: string }
): Promise<SecretaryPdfResponse> {
  try {
    console.log('[secretary/client] transformPdf aufgerufen mit Sprache:', targetLanguage, 'und Template:', template);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extractionMethod', extractionMethod);
    formData.append('useCache', useCache.toString());
    formData.append('includeImages', includeImages.toString());
    formData.append('useIngestionPipeline', useIngestionPipeline.toString());
    
    // Template-Option
    if (template) {
      formData.append('template', template);
    }
    // Kontext-Informationen für zielgenaues Speichern
    if (context?.originalItemId) {
      formData.append('originalItemId', context.originalItemId);
    }
    if (context?.parentId) {
      formData.append('parentId', context.parentId);
    }
    if (context?.originalFileName) {
      formData.append('originalFileName', context.originalFileName);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-pdf', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] PDF-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryPdfResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der PDF-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der PDF-Datei');
  }
}

/**
 * Interface für Image-OCR-Response
 */
export interface SecretaryImageResponse {
  status: string;
  request?: {
    processor: string;
    timestamp: string;
    parameters: {
      file_path: string;
      template: string | null;
      context: string | null;
      extraction_method: string;
    };
  };
  process?: {
    id: string;
    main_processor: string;
    started: string;
    sub_processors: string[];
    completed: string | null;
    duration: number | null;
    is_from_cache: boolean;
    cache_key: string;
    llm_info?: {
      requests: Array<{
        model: string;
        purpose: string;
        tokens: number;
        duration: number;
        processor: string;
        timestamp: string;
      }>;
      requests_count: number;
      total_tokens: number;
      total_duration: number;
    };
  };
  error: unknown | null;
  data: {
    extracted_text: string;
    metadata: {
      file_name: string;
      file_size: number;
      dimensions: string;
      format: string;
      color_mode: string;
      dpi: number[];
      process_dir: string;
      extraction_method: string;
      preview_paths: string[];
    };
    process_id: string;
    processed_at: string;
    status: string;
  };
}

/**
 * Interface für Session-Import-Response
 */
export interface SessionImportResponse {
  status: string;
  data: {
    session: string;
    filename: string;
    track: string;
    video_url: string;
    attachments_url?: string;
    event: string;
    url: string;
    day: string;
    starttime: string;
    endtime: string;
    speakers: string[];
    source_language: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Transformiert ein Bild mithilfe des Secretary Services
 * 
 * @param file Die zu transformierende Bilddatei
 * @param targetLanguage Die Zielsprache für die Verarbeitung
 * @param libraryId ID der aktiven Bibliothek
 * @param extractionMethod Die Extraktionsmethode (ocr, llm, llm_and_ocr, native, both, preview, preview_and_native)
 * @param context Optionaler JSON-Kontext für LLM-Optimierung
 * @param useCache Ob Cache verwendet werden soll
 * @returns Die vollständige Response vom Secretary Service
 */
export async function transformImage(
  file: File,
  targetLanguage: string,
  libraryId: string,
  extractionMethod: string = 'ocr',
  context?: string,
  useCache: boolean = true
): Promise<SecretaryImageResponse> {
  try {
    console.log('[secretary/client] transformImage aufgerufen mit Sprache:', targetLanguage, 'und Methode:', extractionMethod);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLanguage', targetLanguage);
    formData.append('extraction_method', extractionMethod);
    formData.append('useCache', useCache.toString());
    
    // Context-Option
    if (context) {
      formData.append('context', context);
    }
    
    // Angepasste Header bei expliziten Optionen
    const customHeaders: HeadersInit = {};
    customHeaders['X-Library-Id'] = libraryId;
    
    console.log('[secretary/client] Sende Anfrage an Secretary Service API');
    const response = await fetch('/api/secretary/process-image', {
      method: 'POST',
      body: formData,
      headers: customHeaders
    });

    console.log('[secretary/client] Antwort erhalten, Status:', response.status);
    if (!response.ok) {
      throw new SecretaryServiceError(`Fehler bei der Verbindung zum Secretary Service: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[secretary/client] Bild-Daten erfolgreich empfangen');
    
    // Gebe die vollständige Response zurück
    return data as SecretaryImageResponse;
  } catch (error) {
    console.error('[secretary/client] Fehler bei der Bild-Transformation:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError('Fehler bei der Verarbeitung der Bilddatei');
  }
}

/**
 * Importiert Session-Daten aus einer Website-URL mithilfe des Secretary Services
 * 
 * @param url Die zu analysierende Website-URL
 * @param options Optionen für die Session-Extraktion
 * @returns Die extrahierten Session-Daten
 */
export async function importSessionFromUrl(
  url: string,
  options: {
    sourceLanguage?: string;
    targetLanguage?: string;
    template?: string;
    useCache?: boolean;
  } = {}
): Promise<TemplateExtractionResponse> {
  try {
    console.log('[secretary/client] importSessionFromUrl aufgerufen mit URL:', url);
    
    const response = await fetch('/api/secretary/import-from-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        source_language: options.sourceLanguage || 'en',
        target_language: options.targetLanguage || 'en',
        template: options.template || 'ExtractSessionDataFromWebsite',
        use_cache: options.useCache ?? false
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new SecretaryServiceError(
        errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data: TemplateExtractionResponse = await response.json();
    console.log('[secretary/client] Session-Import erfolgreich:', data);
    
    return data;
  } catch (error) {
    console.error('[secretary/client] Fehler beim Session-Import:', error);
    if (error instanceof SecretaryServiceError) {
      throw error;
    }
    throw new SecretaryServiceError(
      error instanceof Error ? error.message : 'Unbekannter Fehler beim Session-Import'
    );
  }
} 
```

- Ich habe die neue Extraktionsmethode „mistral_ocr“ im Options-UI ergänzt und die PDF-Response-Typen erweitert, damit die Rohstruktur (`mistral_ocr_raw`) korrekt typisiert ist. Jetzt kann die Methode end-to-end ausgewählt und durch die API geleitet werden.

So habe ich es umgesetzt:
- UI: In `src/components/library/transform-save-options.tsx` ist „Mistral OCR (LLM)“ als Auswahl verfügbar.
- Typen: In `src/lib/secretary/client.ts` ist `SecretaryPdfResponse.data.mistral_ocr_raw` mit Seiten-, Bild- und Dimensionsdaten ergänzt. Linter ist sauber.

Kurztest (ohne Seiteneditor, nur Methode verifizieren):
1) Öffne den PDF-Bulk-Dialog oder den Einzel-PDF-Dialog, wähle unter „Extraktionsmethode“: „Mistral OCR (LLM)“.
2) Starte die Verarbeitung. Die Route `src/app/api/secretary/process-pdf/route.ts` leitet `extraction_method=mistral_ocr` korrekt weiter.
3) Erwartete Response enthält `data.extracted_text` und optional `data.mistral_ocr_raw.pages[...]`. Prüfe im Netzwerk-Tab/Logs.
4) Falls die Ingestion-Pipeline getestet werden soll: Wir können optional eine UI-Checkbox „Ingestion aktivieren“ ergänzen, die `useIngestionPipeline=true` an dieselbe Route sendet (Server liest das Feld bereits und initialisiert Schritte).

Nächste sinnvolle Schritte (separat umsetzen):
- Seiten-Editor: Links PDF/Seite (Preview), rechts Markdown; je Seite Methode wählbar (ocr/llm/mistral_ocr/…); „Seite bestätigen“-Workflow.
- Metadatenfluss: Kumulative Metadaten je Seite (Kapitelzuordnung, Autor, Ort, Datum, Quelle, Inhaltsverzeichnis-Erkennung) und Weitergabe an Folgeseiten; finaler Merge zu Gesamtdokument.
- Optionaler Schrittablauf: 1) Nur Bilder/Previews extrahieren 2) Seitenweise Prüfen/Transformieren 3) Merge & Validate 4) Ingest.

Zusammenfassung
- `transform-save-options.tsx`: „mistral_ocr“ als Extraktionsmethode ergänzt.
- `client.ts`: `SecretaryPdfResponse` um `mistral_ocr_raw` strukturiert erweitert.
- Ziel: Mistral-OCR-End-to-End nutzbar; Grundlage für Pipeline-Test ist gelegt.

