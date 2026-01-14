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

export default function IntegrationTestsPage() {
  const [activeLibrary] = useAtom(activeLibraryAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const currentPathItems = useAtomValue(currentPathAtom);

  const [selectedIds, setSelectedIds] = useState<string[]>(integrationTestCases.map(tc => tc.id));
  const [fileIdsInput, setFileIdsInput] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('600000');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<UiResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [templates, setTemplates] = useState<Array<{ name: string; id?: string }>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('auto');

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

    const rawIds = fileIdsInput
      .split(',')
      .map(v => v.trim())
      .filter(v => v.length > 0);
    const fileIds = rawIds.length > 0 ? rawIds : undefined;

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
        results?: UiResultItem[];
        summary?: TestSummary;
      };
      const list = Array.isArray(json.results) ? json.results : [];
      setResults(list);
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
          <CardTitle>PDF Transformation – Integrationstests</CardTitle>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-select">
                Template (Override) – Auto = UseCase Default
              </Label>
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
              <Label htmlFor="file-ids">
                Optionale File-IDs (kommagetrennt) – leer = alle PDFs im Ordner
              </Label>
              <Input
                id="file-ids"
                value={fileIdsInput}
                onChange={e => setFileIdsInput(e.target.value)}
                placeholder="z.B. id1,id2,id3"
                disabled={running}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeout">
                Timeout pro Job (ms) – Standard 600000 (10 Minuten)
              </Label>
              <Input
                id="timeout"
                type="number"
                value={timeoutMs}
                onChange={e => setTimeoutMs(e.target.value)}
                disabled={running}
              />
            </div>
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
    </div>
  );
}


