'use client';

import React, { useMemo, useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { activeLibraryAtom, currentFolderIdAtom, currentPathAtom } from '@/atoms/library-atom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { integrationTestCases, type IntegrationTestCase } from '@/lib/integration-tests/test-cases';
import type { ValidationMessage } from '@/lib/integration-tests/validators';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect } from 'react';

interface UiResultItem {
  testCaseId: string;
  testCaseLabel: string;
  fileName: string;
  fileId: string;
  jobId: string;
  ok: boolean;
  messages: ValidationMessage[];
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

interface UiRunListItem {
  runId: string;
  createdAt: string;
  userEmail: string;
  libraryId: string;
  folderId: string;
  testCaseIds: string[];
  fileIds?: string[];
  jobTimeoutMs?: number;
  templateName?: string;
  notesCount?: number;
  summary: TestSummary;
}

interface UiRunNote {
  noteId: string;
  createdAt: string;
  authorType: 'auto' | 'agent' | 'user';
  authorEmail?: string;
  title?: string;
  analysisMarkdown: string;
  nextStepsMarkdown: string;
}

export default function IntegrationTestsPage() {
  const [activeLibrary] = useAtom(activeLibraryAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const currentPathItems = useAtomValue(currentPathAtom);

  const [selectedIds, setSelectedIds] = useState<string[]>(integrationTestCases.map(tc => tc.id));
  const [suiteFilter, setSuiteFilter] = useState<'all' | 'pdf' | 'audio' | 'markdown' | 'txt' | 'website'>('all');
  const [fileKind, setFileKind] = useState<'pdf' | 'audio' | 'markdown' | 'txt' | 'website'>('pdf');
  const [availableFiles, setAvailableFiles] = useState<Array<{ id: string; name: string; mimeType?: string }>>([]);
  const [selectedFileId, setSelectedFileId] = useState<string>('');
  const [fileIdsInput, setFileIdsInput] = useState('');
  const [urlInput, setUrlInput] = useState<string>('');
  const [autoDetectEnabled, setAutoDetectEnabled] = useState<boolean>(true);
  const [timeoutMs, setTimeoutMs] = useState('600000');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<UiResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [templates, setTemplates] = useState<Array<{ name: string; id?: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('auto');
  const [recentRuns, setRecentRuns] = useState<UiRunListItem[]>([]);
  const [recentRunsError, setRecentRunsError] = useState<string | null>(null);
  const [loadingRecentRuns, setLoadingRecentRuns] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [runNotes, setRunNotes] = useState<UiRunNote[]>([]);
  const [noteTitle, setNoteTitle] = useState('Analyse & Next Steps');
  const [noteAnalysis, setNoteAnalysis] = useState('');
  const [noteNextSteps, setNoteNextSteps] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const allSelected = useMemo(
    () => selectedIds.length === integrationTestCases.length,
    [selectedIds],
  );

  const anySelected = selectedIds.length > 0;

  const folderPathLabel = useMemo(() => {
    if (!currentPathItems.length) return '/';
    const names = currentPathItems.map(it => String(it.metadata?.name || '/'));
    return names.join(' / ');
  }, [currentPathItems]);

  // Lade Templates aus MongoDB wenn Library verfügbar ist
  useEffect(() => {
    async function loadTemplates() {
      if (!activeLibrary?.id) {
        setTemplates([]);
        return;
      }
      try {
        const res = await fetch(`/api/templates?libraryId=${encodeURIComponent(activeLibrary.id)}`);
        if (!res.ok) {
          console.warn('[IntegrationTests] Fehler beim Laden der Templates:', res.status);
          setTemplates([]);
          return;
        }
        const json = (await res.json()) as { templates?: Array<{ name: string; _id?: string }> };
        const templateList = Array.isArray(json.templates) ? json.templates : [];
        setTemplates(
          templateList.map(t => ({
            name: t.name,
            id: typeof t._id === 'string' ? t._id : undefined,
          }))
        );
      } catch (e) {
        console.error('[IntegrationTests] Fehler beim Laden der Templates:', e);
        setTemplates([]);
      }
    }
    void loadTemplates();
  }, [activeLibrary?.id]);

  // Suite-Filter: schnelle Umschaltung PDF/AUDIO/MARKDOWN/TXT/WEBSITE (überschreibt die manuelle Auswahl)
  useEffect(() => {
    if (suiteFilter === 'all') {
      setSelectedIds(integrationTestCases.map(tc => tc.id));
      return;
    }
    // Automatisch alle Testcases für den gewählten Typ auswählen
    setSelectedIds(integrationTestCases.filter(tc => tc.target === suiteFilter).map(tc => tc.id));
  }, [suiteFilter]);

  // Automatische Dateityp-Erkennung: Scannt Ordner und erkennt ersten unterstützten Typ
  useEffect(() => {
    async function detectFileType() {
      if (!activeLibrary?.id || !autoDetectEnabled) {
        return;
      }
      try {
        const qs = new URLSearchParams();
        qs.set('libraryId', activeLibrary.id);
        qs.set('folderId', currentFolderId || 'root');
        const res = await fetch(`/api/integration-tests/detect-type?${qs.toString()}`);
        if (!res.ok) {
          return;
        }
        const json = (await res.json()) as { 
          detectedKind?: 'pdf' | 'audio' | 'markdown' | 'txt' | 'website' | null;
          firstFile?: { id: string; name: string; mimeType?: string };
        };
        if (json.detectedKind && json.detectedKind !== fileKind) {
          setFileKind(json.detectedKind);
          // Automatisch Suite-Filter setzen
          setSuiteFilter(json.detectedKind);
          // Erste Datei automatisch auswählen
          if (json.firstFile) {
            setSelectedFileId(json.firstFile.id);
          }
        }
      } catch {
        // Fehler ignorieren (z.B. wenn API nicht verfügbar)
      }
    }
    void detectFileType();
  }, [activeLibrary?.id, currentFolderId, autoDetectEnabled]);

  // Datei-Liste für den aktuellen Ordner + Dateityp laden (UI Vereinfachung)
  useEffect(() => {
    async function loadFiles() {
      if (!activeLibrary?.id) {
        setAvailableFiles([]);
        return;
      }
      try {
        const qs = new URLSearchParams();
        qs.set('libraryId', activeLibrary.id);
        qs.set('folderId', currentFolderId || 'root');
        qs.set('kind', fileKind);
        const res = await fetch(`/api/integration-tests/files?${qs.toString()}`);
        if (!res.ok) {
          setAvailableFiles([]);
          return;
        }
        const json = (await res.json()) as { files?: Array<{ id: string; name: string; mimeType?: string }> };
        setAvailableFiles(Array.isArray(json.files) ? json.files : []);
      } catch {
        setAvailableFiles([]);
      }
    }
    void loadFiles();
  }, [activeLibrary?.id, currentFolderId, fileKind]);

  // Wenn in der UI eine Datei gewählt wurde, füllen wir die (legacy) File-IDs Eingabe automatisch.
  useEffect(() => {
    if (!selectedFileId) return;
    setFileIdsInput(selectedFileId);
  }, [selectedFileId]);

  async function refreshRecentRuns(): Promise<void> {
    setLoadingRecentRuns(true);
    setRecentRunsError(null);
    try {
      const qs = new URLSearchParams();
      qs.set('limit', '25');
      // Filter: In der UI macht es Sinn, nur Runs für die aktuell gewählte Library/Folder zu zeigen.
      if (activeLibrary?.id) qs.set('libraryId', activeLibrary.id);
      // Folder-Filter nur anwenden, wenn wirklich ein konkreter Folder gewählt ist.
      // Viele Sessions sind initial auf "root" → dann wollen wir trotzdem die letzten Runs sehen.
      if (currentFolderId && currentFolderId !== 'root') qs.set('folderId', currentFolderId);
      const res = await fetch(`/api/integration-tests/runs?${qs.toString()}`);
      if (!res.ok) {
        setRecentRunsError(`HTTP ${res.status} ${res.statusText}`);
        setRecentRuns([]);
        return;
      }
      const json = (await res.json()) as { runs?: UiRunListItem[] };
      setRecentRuns(Array.isArray(json.runs) ? json.runs : []);
    } catch (e) {
      setRecentRunsError(e instanceof Error ? e.message : String(e));
      setRecentRuns([]);
    } finally {
      setLoadingRecentRuns(false);
    }
  }

  async function loadRun(runId: string): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/integration-tests/runs/${encodeURIComponent(runId)}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          data && typeof data.error === 'string'
            ? data.error
            : `HTTP ${res.status} ${res.statusText}`;
        setError(msg);
        return;
      }
      const json = (await res.json()) as {
        results?: UiResultItem[];
        summary?: TestSummary;
        notes?: UiRunNote[];
      };
      const list = Array.isArray(json.results) ? json.results : [];
      setResults(list);
      setSummary(
        json.summary || {
          total: list.length,
          passed: list.filter(r => r.ok).length,
          failed: list.filter(r => !r.ok).length,
          skipped: 0,
        }
      );
      setLastRunId(runId);
      setRunNotes(Array.isArray(json.notes) ? json.notes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function createAutoAnalysis(runId: string): Promise<void> {
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/integration-tests/runs/${encodeURIComponent(runId)}/analyze`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          data && typeof data.error === 'string'
            ? data.error
            : `HTTP ${res.status} ${res.statusText}`;
        setError(msg);
        return;
      }
      // Reload run to show new note
      await loadRun(runId);
      await refreshRecentRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingNote(false);
    }
  }

  async function saveManualNoteForRun(runId: string): Promise<void> {
    if (!noteAnalysis.trim() && !noteNextSteps.trim()) {
      setError('Bitte Analyse oder Next Steps ausfüllen.');
      return;
    }
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/integration-tests/runs/${encodeURIComponent(runId)}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteTitle,
          analysisMarkdown: noteAnalysis,
          nextStepsMarkdown: noteNextSteps,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          data && typeof data.error === 'string'
            ? data.error
            : `HTTP ${res.status} ${res.statusText}`;
        setError(msg);
        return;
      }
      setNoteAnalysis('');
      setNoteNextSteps('');
      await loadRun(runId);
      await refreshRecentRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingNote(false);
    }
  }

  // History laden, damit der Agent-Modus transparent wird ("was lief wann mit welchem Ergebnis?")
  useEffect(() => {
    void refreshRecentRuns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLibrary?.id, currentFolderId]);

  function toggleAll(): void {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(integrationTestCases.map(tc => tc.id));
  }

  function toggleSingle(id: string): void {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  }

  async function handleRun(): Promise<void> {
    if (!activeLibrary) {
      setError('Keine aktive Library ausgewählt.');
      return;
    }
    if (!anySelected) {
      setError('Bitte mindestens einen Testfall auswählen.');
      return;
    }

    setRunning(true);
    setError(null);
    setResults([]);
    setSummary(null);

    // URLs als Website-Quellen unterstützen
    const urlInputTrimmed = urlInput.trim();
    let fileIds: string[] | undefined;
    let effectiveFileKind = fileKind;

    if (urlInputTrimmed.length > 0) {
      // URL-Modus: Website-Tests mit URL
      try {
        new URL(urlInputTrimmed); // Validierung
        effectiveFileKind = 'website';
        // Für URLs verwenden wir einen speziellen Marker
        fileIds = [`url:${urlInputTrimmed}`];
      } catch {
        setError(`Ungültige URL: ${urlInputTrimmed}`);
        setRunning(false);
        return;
      }
    } else {
      // Normaler Modus: Dateien aus Input oder automatisch erste Datei
      const rawIds = fileIdsInput
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length > 0);
      fileIds = rawIds.length > 0 ? rawIds : (selectedFileId ? [selectedFileId] : undefined);
    }

    const parsedTimeout = Number(timeoutMs);
    const jobTimeoutMs =
      Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : undefined;

    try {
      const templateName = selectedTemplate === 'auto' ? undefined : selectedTemplate;
      const res = await fetch('/api/integration-tests/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId: activeLibrary.id,
          folderId: currentFolderId,
          testCaseIds: selectedIds,
          fileIds,
          fileKind: effectiveFileKind,
          jobTimeoutMs,
          templateName,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg =
          data && typeof data.error === 'string'
            ? data.error
            : `HTTP ${res.status} ${res.statusText}`;
        setError(msg);
        return;
      }
      const json = (await res.json()) as {
        runId?: string;
        results?: UiResultItem[];
        summary?: TestSummary;
      };
      const list = Array.isArray(json.results) ? json.results : [];
      setResults(list);
      setLastRunId(typeof json.runId === 'string' && json.runId.trim() ? json.runId.trim() : null);
      if (json.summary) {
        setSummary(json.summary);
      } else {
        // Fallback: Summary aus Results berechnen
        setSummary({
          total: list.length,
          passed: list.filter(r => r.ok).length,
          failed: list.filter(r => !r.ok).length,
          skipped: 0,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setRunning(false);
      void refreshRecentRuns();
    }
  }

  function renderMessages(msgs: ValidationMessage[]): JSX.Element {
    if (!msgs.length) return <span className="text-xs text-muted-foreground">Keine Details</span>;
    return (
      <ul className="space-y-1 text-xs">
        {msgs.map((m, idx) => (
          <li
            key={`${m.type}-${idx}`}
            className={
              m.type === 'error'
                ? 'text-red-600 dark:text-red-400'
                : m.type === 'warn'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
            }
          >
            {m.message}
          </li>
        ))}
      </ul>
    );
  }

  const canRun = !!activeLibrary && !!currentFolderId && anySelected && !running;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>PDF & Audio – Integrationstests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Diese Seite führt definierte Integrationstests für die drei PDF-Phasen
            gegen das bestehende External-Job-System aus (inkl. Secretary Service
            und Shadow‑Twin-Verzeichnislogik).
          </p>
          <p>
            Aktive Library:{' '}
            {activeLibrary ? (
              <span className="font-mono">{activeLibrary.label}</span>
            ) : (
              <span className="text-red-600">keine ausgewählt</span>
            )}
          </p>
          <p>
            Testordner:{' '}
            <span className="font-mono">{folderPathLabel}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              ({currentFolderId || 'root'})
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Testfälle auswählen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="select-all"
              checked={allSelected}
              onCheckedChange={() => toggleAll()}
            />
            <Label htmlFor="select-all" className="font-medium cursor-pointer">
              Alle auswählen
            </Label>
            <span className="text-xs text-muted-foreground">
              ({selectedIds.length}/{integrationTestCases.length} ausgewählt)
            </span>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Suite</span>
              <Select
                value={suiteFilter}
                onValueChange={(v) => setSuiteFilter(v === 'audio' ? 'audio' : v === 'pdf' ? 'pdf' : v === 'markdown' ? 'markdown' : 'all')}
                disabled={running}
              >
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="pdf">Nur PDF</SelectItem>
                  <SelectItem value="audio">Nur Audio</SelectItem>
                  <SelectItem value="markdown">Nur Markdown</SelectItem>
                  <SelectItem value="txt">Nur TXT</SelectItem>
                  <SelectItem value="website">Nur Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="w-8 px-2 py-1 text-left" />
                  <th className="w-32 px-2 py-1 text-left">UseCase</th>
                  <th className="w-24 px-2 py-1 text-left">Szenario</th>
                  <th className="px-2 py-1 text-left">Beschreibung</th>
                  <th className="w-24 px-2 py-1 text-left">Kategorie</th>
                </tr>
              </thead>
              <tbody>
                {integrationTestCases.map((tc: IntegrationTestCase) => {
                  const checked = selectedIds.includes(tc.id);
                  const useCaseId = 'useCaseId' in tc && tc.useCaseId ? tc.useCaseId : tc.id.split('.')[0] || 'unknown';
                  const scenarioId = 'scenarioId' in tc && tc.scenarioId ? tc.scenarioId : tc.id.split('.').slice(1).join('.') || tc.id;
                  return (
                    <tr
                      key={tc.id}
                      className="hover:bg-muted/50 align-top"
                    >
                      <td className="px-2 py-1">
                        <Checkbox
                          id={tc.id}
                          checked={checked}
                          onCheckedChange={() => toggleSingle(tc.id)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Label
                          htmlFor={tc.id}
                          className="font-mono text-xs cursor-pointer"
                        >
                          {useCaseId}
                        </Label>
                      </td>
                      <td className="px-2 py-1">
                        <span className="text-xs text-muted-foreground">
                          {scenarioId}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        <div className="font-medium text-xs">
                          {tc.label}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {tc.description}
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wide"
                        >
                          {tc.category}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Einstellungen & Start</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="file-kind">Dateityp</Label>
              <Select
                value={fileKind}
                onValueChange={(v) => {
                  const next = v === 'audio' ? 'audio' 
                    : v === 'markdown' ? 'markdown'
                    : v === 'txt' ? 'txt'
                    : v === 'website' ? 'website'
                    : 'pdf'
                  setFileKind(next)
                  // Usability: wenn der User den Dateityp umstellt, ist ein passender Suite-Filter meist gewünscht.
                  setSuiteFilter(next)
                  // Auswahl leeren (sonst "alte" ID im Input)
                  setSelectedFileId('')
                  // URL-Input leeren wenn Dateityp geändert wird
                  setUrlInput('')
                }}
                disabled={running}
              >
                <SelectTrigger id="file-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                  <SelectItem value="txt">TXT</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-select">Datei (optional)</Label>
              <Select
                value={selectedFileId || 'all'}
                onValueChange={(v) => setSelectedFileId(v === 'all' ? '' : v)}
                disabled={running || !activeLibrary?.id}
              >
                <SelectTrigger id="file-select">
                  <SelectValue placeholder="Alle Dateien (vom Typ) im Ordner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Dateien (vom Typ) im Ordner</SelectItem>
                  {availableFiles.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-select">Template (Override) – Auto = UseCase Default</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate} disabled={running}>
                <SelectTrigger id="template-select">
                  <SelectValue placeholder="Template wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (UseCase Default)</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">Timeout pro Job (ms) – Standard 600000 (10 Minuten)</Label>
              <Input
                id="timeout"
                type="number"
                value={timeoutMs}
                onChange={e => setTimeoutMs(e.target.value)}
                disabled={running}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url-input">
              URL (optional) – Website-Quelle als URL statt Datei
            </Label>
            <Input
              id="url-input"
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
              disabled={running}
            />
            <p className="text-xs text-muted-foreground">
              Wenn eine URL eingegeben wird, wird diese als Website-Quelle verwendet (überschreibt Datei-Auswahl).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file-ids">
              File-IDs (Advanced, kommagetrennt) – leer = alle Dateien des Dateityps im Ordner
            </Label>
            <Input
              id="file-ids"
              value={fileIdsInput}
              onChange={e => setFileIdsInput(e.target.value)}
              placeholder="z.B. id1,id2,id3"
              disabled={running || urlInput.trim().length > 0}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-detect"
              checked={autoDetectEnabled}
              onChange={e => setAutoDetectEnabled(e.target.checked)}
              disabled={running}
              className="h-4 w-4"
            />
            <Label htmlFor="auto-detect" className="text-sm">
              Automatische Dateityp-Erkennung aktivieren (erkennt ersten unterstützten Typ im Ordner)
            </Label>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Button
            variant="default"
            onClick={() => void handleRun()}
            disabled={!canRun}
            className="flex items-center gap-2"
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Tests laufen...
              </>
            ) : (
              <>Tests starten</>
            )}
          </Button>

          {lastRunId ? (
            <div className="text-xs text-muted-foreground">
              Letzter Run: <span className="font-mono">{lastRunId}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ergebnisse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {summary && (
            <div className="flex items-center gap-4 p-3 bg-muted rounded-md">
              <div className="text-sm">
                <span className="font-semibold">Gesamt:</span> {summary.total}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">
                <span className="font-semibold">Erfolgreich:</span> {summary.passed}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                <span className="font-semibold">Fehlgeschlagen:</span> {summary.failed}
              </div>
              {summary.skipped > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-semibold">Übersprungen:</span> {summary.skipped}
                </div>
              )}
            </div>
          )}
          {results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Noch keine Ergebnisse – starte einen Testlauf.
            </p>
          )}
          {results.length > 0 && (
            <div className="border rounded-md overflow-x-auto">
              <div className="min-w-full divide-y text-sm">
                {results.map((r, idx) => (
                  <div key={`${r.testCaseId}-${r.fileId}-${idx}`} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">{r.testCaseId}</span>
                          <span className="font-semibold">{r.testCaseLabel}</span>
                          {r.ok ? (
                            <Badge
                              variant="outline"
                              className="border-green-500 text-green-700 dark:text-green-300"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-red-500 text-red-700 dark:text-red-300"
                            >
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Fehler
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-x-2">
                          <span>File: {r.fileName}</span>
                          <span className="font-mono">({r.fileId})</span>
                          <span>
                            Job:{' '}
                            <span className="font-mono">{r.jobId}</span>
                          </span>
                          {r.jobId !== 'n/a' && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => void navigator.clipboard.writeText(r.jobId)}
                              >
                                Copy
                              </Button>
                              <a
                                href={`/api/external/jobs/${encodeURIComponent(r.jobId)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline text-muted-foreground hover:text-foreground"
                              >
                                Job JSON
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">{renderMessages(r.messages)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Letzte Testläufe (History)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshRecentRuns()}
            disabled={loadingRecentRuns}
          >
            {loadingRecentRuns ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Laden…
              </span>
            ) : (
              'Aktualisieren'
            )}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Persistent (MongoDB). Runs bleiben auch nach Server‑Restart verfügbar.
          </p>

          {recentRunsError ? (
            <div className="text-sm text-red-600">{recentRunsError}</div>
          ) : null}

          <div className="border rounded-md overflow-hidden">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-muted">
                <tr>
                  <th className="w-44 px-2 py-1 text-left">Zeit</th>
                  <th className="w-56 px-2 py-1 text-left">Run</th>
                  <th className="w-24 px-2 py-1 text-left">Summary</th>
                  <th className="w-20 px-2 py-1 text-left">Tests</th>
                  <th className="w-20 px-2 py-1 text-left">Files</th>
                  <th className="px-2 py-1 text-left">Template</th>
                  <th className="w-16 px-2 py-1 text-left">Notes</th>
                  <th className="w-24 px-2 py-1 text-left">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-muted-foreground" colSpan={8}>
                      Keine Runs gespeichert.
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((r) => {
                    const failed = r.summary?.failed || 0;
                    const passed = r.summary?.passed || 0;
                    const total = r.summary?.total || 0;
                    const ok = failed === 0 && total > 0;
                    return (
                      <tr key={r.runId} className="border-t">
                        <td className="px-2 py-2 font-mono whitespace-nowrap">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="px-2 py-2 font-mono break-all">{r.runId}</td>
                        <td className="px-2 py-2">
                          <Badge variant={ok ? 'default' : 'destructive'}>
                            {passed}/{total}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">{r.testCaseIds?.length || 0}</td>
                        <td className="px-2 py-2">{r.fileIds?.length || 0}</td>
                        <td className="px-2 py-2">{r.templateName || 'auto'}</td>
                        <td className="px-2 py-2">{typeof r.notesCount === 'number' ? r.notesCount : 0}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void loadRun(r.runId)}
                              disabled={running}
                            >
                              Laden
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void createAutoAnalysis(r.runId)}
                              disabled={savingNote || running}
                            >
                              Analyse
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analyse & Next Steps (pro Run)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!lastRunId ? (
            <p className="text-sm text-muted-foreground">
              Wähle in der History einen Run und klicke „Laden“ (oder „Analyse“), um Notes zu sehen/zu speichern.
            </p>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                Aktiver Run: <span className="font-mono">{lastRunId}</span>
              </div>

              {runNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Notes gespeichert. Du kannst „Analyse“ in der History drücken oder unten manuell speichern.
                </p>
              ) : (
                <div className="border rounded-md p-3 space-y-3">
                  {runNotes
                    .slice()
                    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
                    .map((n) => (
                      <div key={n.noteId} className="border-b last:border-b-0 pb-3 last:pb-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">{n.authorType}</Badge>
                          <span className="font-mono">{new Date(n.createdAt).toLocaleString()}</span>
                          {n.authorEmail ? <span className="text-muted-foreground">{n.authorEmail}</span> : null}
                          {n.title ? <span className="font-semibold">{n.title}</span> : null}
                        </div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="font-semibold mb-1">Analyse</div>
                            <pre className="whitespace-pre-wrap text-muted-foreground">{n.analysisMarkdown}</pre>
                          </div>
                          <div>
                            <div className="font-semibold mb-1">Next Steps</div>
                            <pre className="whitespace-pre-wrap text-muted-foreground">{n.nextStepsMarkdown}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              <div className="border rounded-md p-3 space-y-3">
                <div className="text-xs font-semibold">Neue Note speichern</div>
                <div className="space-y-2">
                  <Label htmlFor="note-title">Titel</Label>
                  <Input
                    id="note-title"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    disabled={savingNote}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="note-analysis">Analyse (Markdown)</Label>
                    <textarea
                      id="note-analysis"
                      className="w-full min-h-32 rounded-md border bg-background p-2 text-xs"
                      value={noteAnalysis}
                      onChange={(e) => setNoteAnalysis(e.target.value)}
                      disabled={savingNote}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="note-next">Next Steps (Markdown)</Label>
                    <textarea
                      id="note-next"
                      className="w-full min-h-32 rounded-md border bg-background p-2 text-xs"
                      value={noteNextSteps}
                      onChange={(e) => setNoteNextSteps(e.target.value)}
                      disabled={savingNote}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => lastRunId && void saveManualNoteForRun(lastRunId)}
                  disabled={!lastRunId || savingNote}
                >
                  {savingNote ? 'Speichern…' : 'Note speichern'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


