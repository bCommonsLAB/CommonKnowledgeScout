'use client';

import * as React from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronUp, Maximize2, Minimize2, Copy } from 'lucide-react';
import { debugStateAtom, toggleComponentAtom, toggleAreaAtom, clearLogsAtom, addLogAtom } from '@/atoms/debug-atom';
import { cn } from '@/lib/utils';
import { subscribeToLogs } from '@/lib/debug/logger';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { activeLibraryAtom, activeLibraryIdAtom, currentFolderIdAtom, selectedFileAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { galleryFiltersAtom } from '@/atoms/gallery-filters';
import { usePathname, useRouter } from 'next/navigation';
import { shadowTwinStateAtom } from '@/atoms/shadow-twin-atom';
import { ShadowTwinArtifactsTable } from '@/components/library/shared/shadow-twin-artifacts-table';
import { useShadowTwinFreshnessApi, type FreshnessStatus } from '@/hooks/use-shadow-twin-freshness';
import { FreshnessComparisonPanel } from '@/components/library/shared/freshness-comparison-panel';

interface IngestionBreakdown {
  doc: number;
  chapterSummary: number;
  chunk: number;
  uniqueDocs: number;
}

interface IngestionStatsResponse {
  ok?: boolean;
  indexExists?: boolean;
  totals?: { docs?: number; chunks?: number };
  breakdown?: IngestionBreakdown;
  error?: string;
}

export default function DebugFooter() {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isFullHeight, setIsFullHeight] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'performance' | 'system' | 'shadow-twin'>('performance');
  const pathname = usePathname();
  const router = useRouter();

  // Modul-Erkennung: grobe Heuristik per Route
  const moduleKey = React.useMemo<"gallery" | "library" | "other">(() => {
    if (!pathname) return 'other';
    if (pathname.startsWith('/library/gallery')) return 'gallery';
    if (pathname.startsWith('/library')) return 'library';
    return 'other';
  }, [pathname]);

  // Atoms
  const [debugState] = useAtom(debugStateAtom);
  const [, setToggleComponent] = useAtom(toggleComponentAtom);
  const [, setToggleArea] = useAtom(toggleAreaAtom);
  const [, setClearLogs] = useAtom(clearLogsAtom);
  const [, setAddLog] = useAtom(addLogAtom);

  // Library State
  const [activeLibrary] = useAtom(activeLibraryAtom);
  const [activeLibraryId] = useAtom(activeLibraryIdAtom);
  const [currentFolderId] = useAtom(currentFolderIdAtom);
  const { provider, libraryStatus } = useStorage();

  // Ingestion-Stats (nur relevant für Galerie-Modul)
  const [statsLoading, setStatsLoading] = React.useState(false);
  const [statsError, setStatsError] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<IngestionStatsResponse | null>(null);
  const galleryFilters = useAtomValue(galleryFiltersAtom);

  const loadIngestionStats = React.useCallback(async () => {
    if (!activeLibraryId) return;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const params = new URLSearchParams();
      // Scope: library (Default)
      params.set('scope', 'library');
      // Facetten nur im Galerie-Modul anhängen, um Zählung identisch zu machen
      if (moduleKey === 'gallery' && galleryFilters) {
        Object.entries(galleryFilters as Record<string, string[] | undefined>).forEach(([k, arr]) => {
          if (Array.isArray(arr)) for (const v of arr) params.append(k, String(v));
        });
      }
      const url = `/api/chat/${encodeURIComponent(activeLibraryId)}/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = (await res.json()) as unknown;
      if (!res.ok) throw new Error(typeof (data as { error?: unknown })?.error === 'string' ? (data as { error?: string }).error : 'Fehler beim Laden der Ingestion-Stats');
      setStats(data as IngestionStatsResponse);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setStatsError(msg);
    } finally {
      setStatsLoading(false);
    }
  }, [activeLibraryId, moduleKey, galleryFilters]);

  // Nur laden, wenn Panel sichtbar und System-Tab aktiv und im Galerie-Modul
  React.useEffect(() => {
    if (!isExpanded) return;
    if (activeTab !== 'system') return;
    if (moduleKey !== 'gallery') return;
    void loadIngestionStats();
  }, [isExpanded, activeTab, moduleKey, loadIngestionStats]);

  // Debug Info für System Tab
  const debugInfo = React.useMemo(() => [
    { label: 'Library', value: activeLibrary ? `${activeLibrary.label} (${activeLibraryId})` : 'Keine' },
    { label: 'Provider', value: provider?.name || 'Kein Provider' },
    { label: 'Provider-Key', value: activeLibrary?.type || 'Unbekannt' },
    { label: 'Status', value: libraryStatus },
    { label: 'Token vorhanden', value: provider?.getAuthInfo?.() ? 'Ja' : 'Nein' },
    { label: 'Aktive Library-ID', value: activeLibraryId },
    { label: 'Auth', value: provider?.getAuthInfo?.() || 'Keine Auth-Info' },
    { label: 'Ordner', value: currentFolderId },
  ], [activeLibrary, activeLibraryId, provider, libraryStatus, currentFolderId]);

  // Subscribe to logs
  React.useEffect(() => {
    const unsubscribe = subscribeToLogs((entry) => {
      // Verwende React.startTransition für nicht-kritische Updates
      React.startTransition(() => {
        setAddLog(entry);
      });
    });
    return unsubscribe;
  }, [setAddLog]);

  // Komponenten und Areas für Filter
  const components = React.useMemo(() => {
    const componentSet = new Set<string>();
    debugState.logs.forEach(log => componentSet.add(log.component));
    return Array.from(componentSet).sort();
  }, [debugState.logs]);

  // Presets für Komponenten/Areas
  const applyPreset = React.useCallback((preset: { components: string[]; areas: Array<'nav' | 'state' | 'file' | 'ui'> }) => {
    // Komponenten: gewünschte Menge auf verfügbare beschränken
    const desired = new Set(preset.components.filter(c => components.includes(c)));
    // Aktuelle Sichtbarkeit auf gewünschte Menge bringen
    components.forEach((c) => {
      const isVisible = debugState.visibleComponents.has(c);
      const shouldBeVisible = desired.has(c);
      if (isVisible !== shouldBeVisible) setToggleComponent(c);
    });
    // Areas anpassen
    (['nav','state','file','ui'] as const).forEach((a) => {
      const isVisible = debugState.visibleAreas.has(a);
      const shouldBeVisible = preset.areas.includes(a);
      if (isVisible !== shouldBeVisible) setToggleArea(a);
    });
  }, [components, debugState.visibleComponents, debugState.visibleAreas, setToggleComponent, setToggleArea]);

  // Gefilterte und sortierte Logs
  const filteredLogs = React.useMemo(() => {
    return debugState.logs
      .filter(log => 
        debugState.visibleComponents.has(log.component) &&
        debugState.visibleAreas.has(log.area)
      )
      .slice(0, 200) // Limitiere auf 200 Einträge
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Neueste zuerst
  }, [debugState.logs, debugState.visibleComponents, debugState.visibleAreas]);

  // Duplikaterkennung
  const logsWithRemarks = React.useMemo(() => {
    const messageCount = new Map<string, number>();
    const duplicateKeys = new Set<string>();
    
    // Erstelle einen deterministischen Schlüssel für ein Objekt
    const createDetailsKey = (details: Record<string, unknown> | undefined): string => {
      if (!details) return '';
      
      // Sortiere Keys für konsistente Reihenfolge
      const sortedKeys = Object.keys(details).sort();
      
      // Erstelle ein normalisiertes Objekt
      const normalizedDetails = sortedKeys.reduce((acc, key) => {
        const value = details[key];
        // Rekursiv für verschachtelte Objekte
        acc[key] = typeof value === 'object' && value !== null
          ? createDetailsKey(value as Record<string, unknown>)
          : value;
        return acc;
      }, {} as Record<string, unknown>);
      
      return JSON.stringify(normalizedDetails);
    };

    // Zähle identische Nachrichten
    filteredLogs.forEach(log => {
      // Erstelle einen detaillierten Schlüssel aus allen relevanten Informationen
      const detailsKey = createDetailsKey(log.details);
      const key = `${log.component}:${log.message}:${log.area}:${detailsKey}`;
      messageCount.set(key, (messageCount.get(key) || 0) + 1);
    });
    
    // Markiere Duplikate
    messageCount.forEach((count, key) => {
      if (count > 1) {
        duplicateKeys.add(key);
      }
    });
    
    // Füge Remarks hinzu
    return filteredLogs.map(log => {
      const detailsKey = createDetailsKey(log.details);
      const key = `${log.component}:${log.message}:${log.area}:${detailsKey}`;
      const remarks: string[] = [];
      
      if (duplicateKeys.has(key)) {
        remarks.push(`Duplicate (${messageCount.get(key)}x)`);
      }
      
      if (log.level === 'error') {
        remarks.push('Error');
      }
      
      return {
        ...log,
        remarks: remarks.join(', '),
        isDuplicate: duplicateKeys.has(key)
      };
    });
  }, [filteredLogs]);

  // Unique Spalten für die Tabelle ermitteln
  const columns = React.useMemo(() => {
    const allKeys = new Set<string>();
    allKeys.add('timestamp');
    allKeys.add('remarks'); // Remarks an zweiter Stelle
    allKeys.add('component');
    allKeys.add('area');
    allKeys.add('level');
    allKeys.add('message');
    
    logsWithRemarks.forEach(log => {
      if (log.details) {
        Object.keys(log.details).forEach(key => allKeys.add(`details.${key}`));
      }
    });
    
    return Array.from(allKeys);
  }, [logsWithRemarks]);

  // Checkbox-Handler für Komponenten
  const handleComponentToggle = React.useCallback((checked: boolean | 'indeterminate', component: string) => {
    if (typeof checked === 'boolean') {
      setToggleComponent(component);
    }
  }, [setToggleComponent]);

  // Checkbox-Handler für Areas
  const handleAreaToggle = React.useCallback((checked: boolean | 'indeterminate', area: 'nav' | 'state' | 'file' | 'ui') => {
    if (typeof checked === 'boolean') {
      setToggleArea(area);
    }
  }, [setToggleArea]);

  // Integration-Test Seite mit aktuellem Kontext öffnen
  const handleOpenIntegrationTests = React.useCallback(() => {
    if (!activeLibraryId || !currentFolderId) {
      toast.error('Aktive Library oder Ordner unbekannt – bitte zuerst eine Library und einen Ordner wählen.');
      return;
    }
    const params = new URLSearchParams({
      libraryId: activeLibraryId,
      folderId: currentFolderId,
    });
    router.push(`/integration-tests?${params.toString()}`);
  }, [router, activeLibraryId, currentFolderId]);

  // Copy Logs Funktion
  const handleCopyLogs = React.useCallback(() => {
    try {
      // Erstelle ein übersichtliches Debug-Objekt
      const debugData = {
        timestamp: new Date().toISOString(),
        system: {
          library: debugInfo.reduce((acc, info) => {
            acc[info.label] = info.value;
            return acc;
          }, {} as Record<string, string>)
        },
        visibleComponents: Array.from(debugState.visibleComponents),
        visibleAreas: Array.from(debugState.visibleAreas),
        duplicates: Array.from(new Set(logsWithRemarks.filter(log => log.isDuplicate).map(log => `${log.component}:${log.message}`))),
        errors: logsWithRemarks.filter(log => log.level === 'error').length,
        logs: logsWithRemarks.map(log => {
          // Sicheres Parsen des Zeitstempels
          let formattedTimestamp = log.timestamp;
          try {
            // Wenn der Zeitstempel kein Datum enthält, füge das heutige Datum hinzu
            if (!formattedTimestamp.includes('T')) {
              const today = new Date().toISOString().split('T')[0];
              formattedTimestamp = `${today}T${formattedTimestamp}`;
            }
            const date = new Date(formattedTimestamp);
            if (!isNaN(date.getTime())) {
              formattedTimestamp = date.toISOString();
            }
          } catch {
            // Behalte den originalen Zeitstempel bei Fehler
            console.warn('Ungültiger Zeitstempel:', log.timestamp);
          }

          const { ...logData } = log;
          return {
            ...logData,
            timestamp: formattedTimestamp,
            details: log.details || {}
          };
        })
      };

      // Kopiere in die Zwischenablage mit schöner Formatierung
      navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
      
      toast.success('Debug Logs kopiert', {
        description: `${logsWithRemarks.length} Einträge, ${debugData.duplicates.length} Duplikate und ${debugData.errors} Fehler in die Zwischenablage kopiert`
      });
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
      toast.error('Fehler beim Kopieren der Logs');
    }
  }, [logsWithRemarks, debugInfo, debugState.visibleComponents, debugState.visibleAreas]);

  return (
    <>
      {/* Handle - immer sichtbar, minimaler Handle am unteren Rand (rechtsbündig mit 40px Abstand) */}
      <div 
        className={cn(
          "fixed bottom-0 right-[40px] h-6 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/40 border border-t-0 rounded-t-lg cursor-pointer hover:bg-muted/50 transition-colors z-50 flex items-center justify-center px-4 min-w-[60px]"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ChevronUp className={cn(
          "h-3 w-3 text-muted-foreground transition-transform",
          isExpanded && "rotate-180"
        )} />
      </div>

      {/* Panel - nur sichtbar wenn ausgeklappt */}
      {isExpanded && (
        <div 
          className={cn(
            "fixed bottom-6 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t transition-all duration-200 z-40 flex flex-col",
            !isFullHeight && "h-72",
            isFullHeight && "h-[calc(100vh-64px-24px)]"
          )}
        >
          {/* Header - innerhalb des Panels */}
          <div className="flex items-center justify-between px-4 h-8 border-b">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Debug Panel</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullHeight(!isFullHeight);
                }}
              >
                {isFullHeight ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
            {/* Preset-Buttons modulabhängig */}
            {moduleKey !== 'other' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6"
                  onClick={() => applyPreset(moduleKey === 'gallery'
                    ? { components: ['Gallery', 'ChatPanel', 'IngestionBookDetail', 'FileList'], areas: ['nav','state','file'] }
                    : { components: ['FileTree', 'Breadcrumb', 'FileList', 'FilePreview'], areas: ['nav','state','file'] }
                  )}
                >
                  Preset: {moduleKey === 'gallery' ? 'Gallery' : 'Library'}
                </Button>
              </>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6"
              onClick={handleCopyLogs}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy Logs
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6" 
              onClick={() => setClearLogs()}
            >
              Clear Logs
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6"
              onClick={handleOpenIntegrationTests}
            >
              Integration Test
            </Button>
          </div>
          </div>

          {/* Content - unterhalb des Headers */}
          <div className="flex flex-col flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Filter Panel */}
            <ResizablePanel defaultSize={15} minSize={10} maxSize={20}>
              <div className="p-2 h-full overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-medium mb-1">Components</h4>
                    <ScrollArea className="h-24">
                      {components.map(component => (
                        <div key={component} className="flex items-center space-x-2 py-0.5">
                          <Checkbox
                            id={`component-${component}`}
                            checked={debugState.visibleComponents.has(component)}
                            onCheckedChange={(checked) => {
                              handleComponentToggle(checked, component);
                            }}
                            className="h-3 w-3"
                          />
                          <label
                            htmlFor={`component-${component}`}
                            className="text-xs leading-none"
                          >
                            {component}
                          </label>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>

                  <div>
                    <h4 className="text-xs font-medium mb-1">Areas</h4>
                    <div className="space-y-1">
                      {(['nav', 'state', 'file', 'ui'] as const).map(area => (
                        <div key={area} className="flex items-center space-x-2">
                          <Checkbox
                            id={`area-${area}`}
                            checked={debugState.visibleAreas.has(area)}
                            onCheckedChange={(checked) => {
                              handleAreaToggle(checked, area);
                            }}
                            className="h-3 w-3"
                          />
                          <label
                            htmlFor={`area-${area}`}
                            className="text-xs leading-none"
                          >
                            {area.toUpperCase()}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle />

            {/* Main Content */}
            <ResizablePanel defaultSize={85} minSize={80}>
              <div className="h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'performance' | 'system' | 'shadow-twin')} className="flex-1 flex flex-col overflow-hidden">
                  <div className="border-b px-2 flex-shrink-0">
                    <TabsList className="h-7">
                      <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
                      <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
                      <TabsTrigger value="shadow-twin" className="text-xs">Shadow-Twin</TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="performance" className="flex-1 p-0 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
                    <ScrollArea className="flex-1 w-full">
                      <div className="min-w-max p-2">
                        <table className="w-full border-collapse text-xs">
                          <thead className="sticky top-0 bg-background z-10">
                            <tr className="bg-muted/50">
                              {columns.map(column => (
                                <th key={column} className="p-1 text-left font-medium border-b">
                                  {column.startsWith('details.') ? `.${column.split('.')[1]}` : column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {logsWithRemarks.map(log => (
                              <tr 
                                key={log.id}
                                className={cn(
                                  "hover:bg-muted/50",
                                  log.level === 'error' && "bg-red-500/20 hover:bg-red-500/30",
                                  log.isDuplicate && log.level !== 'error' && "bg-yellow-500/20 hover:bg-yellow-500/30",
                                  log.level === 'warn' && !log.isDuplicate && "bg-orange-500/20 hover:bg-orange-500/30",
                                  log.level === 'info' && !log.isDuplicate && "bg-blue-500/10 hover:bg-blue-500/20"
                                )}
                              >
                                {columns.map(column => {
                                  const value = column === 'remarks' 
                                    ? log.remarks
                                    : column === 'timestamp'
                                      ? log.timestamp.split('T')[1]?.split('.')[0] || log.timestamp
                                      : column.startsWith('details.') 
                                        ? log.details?.[column.split('.')[1]] 
                                        : (log as Record<string, unknown>)[column];
                                  
                                  return (
                                    <td key={column} className="p-1 border-b border-muted/20 whitespace-nowrap">
                                      {typeof value === 'object' 
                                        ? JSON.stringify(value) 
                                        : String(value || '')}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <ScrollBar orientation="horizontal" />
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="system" className="flex-1 p-0 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
                    <ScrollArea className="flex-1 w-full">
                      <div className="p-4">
                        {/* Library Debug Info */}
                        <div>
                          <h3 className="text-sm font-medium mb-2">Library Status</h3>
                          <div className="space-y-1 text-xs">
                            {debugInfo.map((info, index) => (
                              <div key={index} className="flex items-start gap-2 py-0.5">
                                <span className="text-muted-foreground min-w-[140px] shrink-0">{info.label}:</span>
                                <span className="text-foreground break-all">{info.value}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Ingestion – nur für Galerie-Modul sichtbar */}
                        {moduleKey === 'gallery' ? (
                          <div className="mt-6">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium">Ingestion</h3>
                              <Button variant="ghost" size="sm" className="h-6" onClick={() => void loadIngestionStats()} disabled={statsLoading}>
                                Aktualisieren
                              </Button>
                            </div>
                            <div className="mt-2 text-xs">
                              {statsLoading ? (
                                <div className="text-muted-foreground">Lade...</div>
                              ) : statsError ? (
                                <div className="text-red-600">Fehler: {statsError}</div>
                              ) : stats ? (
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Index</div>
                                    <div className="font-medium">{stats.indexExists ? 'vorhanden' : 'nicht vorhanden'}</div>
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <div className="text-muted-foreground">Index Name</div>
                                    <div className="font-medium break-all">{(stats as { info?: { indexName?: string } }).info?.indexName || '—'}</div>
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <div className="text-muted-foreground">Index Host</div>
                                    <div className="font-medium break-all">{(stats as { info?: { indexHost?: string } }).info?.indexHost || '—'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Scope</div>
                                    <div className="font-medium">{(stats as { info?: { scope?: string } }).info?.scope || 'library'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Docs (unique)</div>
                                    <div className="font-medium">{stats.breakdown?.uniqueDocs ?? stats.totals?.docs ?? '—'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Doc‑Meta</div>
                                    <div className="font-medium">{stats.breakdown?.doc ?? '—'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Chapters</div>
                                    <div className="font-medium">{stats.breakdown?.chapterSummary ?? '—'}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Chunks</div>
                                    <div className="font-medium">{stats.breakdown?.chunk ?? stats.totals?.chunks ?? '—'}</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-muted-foreground">Keine Daten</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="shadow-twin" className="flex-1 p-0 m-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
                    <ScrollArea className="flex-1 w-full">
                      <div className="p-4">
                        <ShadowTwinDebugContent />
                      </div>
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Binary Fragment aus MongoDB
 */
interface BinaryFragmentInfo {
  name: string
  kind: string
  url?: string
  mimeType?: string
  size?: number
  createdAt?: string
}

/**
 * Shadow-Twin-Debug-Content-Komponente
 * Zeigt den Shadow-Twin-State der ausgewählten Datei an
 */
/** Kurze deutsche Labels für Freshness-Status */
const FRESHNESS_LABELS: Record<FreshnessStatus, { label: string; color: string }> = {
  'loading': { label: 'Wird geprüft…', color: 'text-muted-foreground' },
  'synced': { label: 'Synchron', color: 'text-green-600' },
  'source-newer': { label: 'Quelldatei neuer', color: 'text-amber-600' },
  'storage-newer': { label: 'Storage neuer', color: 'text-blue-600' },
  'storage-missing': { label: 'Storage fehlt', color: 'text-red-600' },
  'no-twin': { label: 'Kein Shadow-Twin', color: 'text-slate-600' },
}

function ShadowTwinDebugContent() {
  const shadowTwinStates = useAtomValue(shadowTwinStateAtom);
  const selectedFile = useAtomValue(selectedFileAtom);
  const activeLibraryId = useAtomValue(activeLibraryIdAtom);
  
  // State für binaryFragments aus MongoDB
  const [binaryFragments, setBinaryFragments] = React.useState<BinaryFragmentInfo[]>([]);
  const [loadingFragments, setLoadingFragments] = React.useState(false);

  // Lade binaryFragments aus MongoDB, wenn Datei ausgewählt ist
  React.useEffect(() => {
    if (!activeLibraryId || !selectedFile) {
      setBinaryFragments([]);
      return;
    }

    let cancelled = false;
    const fileId = selectedFile.id; // Lokale Kopie für Closure
    async function loadFragments() {
      setLoadingFragments(true);
      try {
        const res = await fetch(`/api/library/${activeLibraryId}/shadow-twins/binary-fragments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceIds: [fileId] }),
        });

        if (!res.ok) {
          // Ignoriere Fehler (z.B. wenn Mongo nicht aktiv ist)
          if (!cancelled) setBinaryFragments([]);
          return;
        }

        const json = await res.json() as { fragments?: BinaryFragmentInfo[] };
        if (cancelled) return;

        // Filtere nur echte Binärdateien (keine Markdown)
        const binaries = (json.fragments || []).filter(f => f.kind !== 'markdown');
        setBinaryFragments(binaries);
      } catch {
        if (!cancelled) setBinaryFragments([]);
      } finally {
        if (!cancelled) setLoadingFragments(false);
      }
    }

    void loadFragments();
    return () => { cancelled = true; };
  }, [activeLibraryId, selectedFile]);

  // Hooks müssen immer in derselben Reihenfolge aufgerufen werden (vor bedingten Returns)
  const state = selectedFile ? shadowTwinStates.get(selectedFile.id) : undefined;
  const freshness = useShadowTwinFreshnessApi(activeLibraryId, selectedFile, state);
  const freshnessLabel = FRESHNESS_LABELS[freshness.status];

  if (!selectedFile) {
    return (
      <div className="text-sm text-muted-foreground">
        Keine Datei ausgewählt. Wählen Sie eine Datei aus, um den Shadow-Twin-State zu sehen.
      </div>
    );
  }

  if (!state) {
    return (
      <div className="text-sm text-muted-foreground">
        Kein Shadow‑Twin‑State für &quot;{selectedFile.metadata.name}&quot; vorhanden. Noch nicht analysiert (oder Analyse läuft).
      </div>
    );
  }

  const hasTranscript = Boolean(state.transcriptFiles && state.transcriptFiles.length > 0)
  const hasTransform = Boolean(state.transformed)
  const isEmptyButChecked = !hasTranscript && !hasTransform

  // Extrahiere Artefakte aus dem State für die Tabellenansicht
  const artifacts: Array<{
    sourceId: string
    sourceName: string
    artifactFileName: string
    kind: 'transcript' | 'transformation'
    targetLanguage: string
    templateName?: string
    mongoUpserted: boolean
    filesystemDeleted?: boolean
  }> = []

  // Füge Transcript-Artefakte hinzu
  if (state.transcriptFiles && state.transcriptFiles.length > 0) {
    for (const file of state.transcriptFiles) {
      // Extrahiere targetLanguage aus dem Dateinamen (z.B. "transcript.de.md" -> "de")
      const langMatch = file.metadata.name.match(/\.([a-z]{2})\.md$/i)
      const targetLanguage = langMatch ? langMatch[1] : 'de'
      
      artifacts.push({
        sourceId: selectedFile.id,
        sourceName: selectedFile.metadata.name,
        artifactFileName: file.metadata.name,
        kind: 'transcript',
        targetLanguage,
        mongoUpserted: false, // Wird von der Komponente aus MongoDB geladen
        filesystemDeleted: false,
      })
    }
  }

  // Füge Transformation-Artefakte hinzu
  if (state.transformed) {
    // Extrahiere templateName und targetLanguage aus dem Dateinamen
    // Format: "{templateName}.{targetLanguage}.md" oder "{sourceName}.{templateName}.{targetLanguage}.md"
    const fileName = state.transformed.metadata.name
    const parts = fileName.replace(/\.md$/i, '').split('.')
    const targetLanguage = parts.length >= 2 ? parts[parts.length - 1] : 'de'
    const templateName = parts.length >= 3 ? parts[parts.length - 2] : undefined

    artifacts.push({
      sourceId: selectedFile.id,
      sourceName: selectedFile.metadata.name,
      artifactFileName: fileName,
      kind: 'transformation',
      targetLanguage,
      templateName,
      mongoUpserted: false, // Wird von der Komponente aus MongoDB geladen
      filesystemDeleted: false,
    })
  }

  // Kompakte Zusammenfassung: Anzahl Artefakte und Binaries
  const transcriptCount = state.transcriptFiles?.length || 0
  const transformCount = state.transformed ? 1 : 0
  const mediaCount = state.mediaFiles?.length || 0
  const binaryCount = binaryFragments.length

  return (
    <div className="space-y-3">
      {/* Kompakte Übersicht: Source + Artefakte auf einen Blick */}
      {isEmptyButChecked && (
        <div className="rounded border bg-muted/30 p-2 text-xs text-muted-foreground">
          Analysiert: keine Artefakte gefunden (noch nicht verarbeitet).
        </div>
      )}

      {state.analysisError && (
        <div className="rounded border border-red-200 bg-red-50 p-2">
          <div className="text-xs font-medium text-red-600">Analysefehler</div>
          <div className="text-xs text-red-600 break-all mt-1">{state.analysisError}</div>
        </div>
      )}

      {/* Kompakte Key-Value-Übersicht */}
      <table className="w-full text-xs">
        <tbody>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Source</td>
            <td className="py-1 break-all">{state.baseItem.metadata.name}</td>
          </tr>
          {state.transformed && (
            <tr className="border-b">
              <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Transformation</td>
              <td className="py-1 break-all">{state.transformed.metadata.name}</td>
            </tr>
          )}
          {transcriptCount > 0 && (
            <tr className="border-b">
              <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">
                Transkript{transcriptCount > 1 ? `e (${transcriptCount})` : ''}
              </td>
              <td className="py-1 break-all">
                {state.transcriptFiles!.map(f => f.metadata.name).join(', ')}
              </td>
            </tr>
          )}
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Zusammenfassung</td>
            <td className="py-1">
              <span className="inline-flex gap-2 flex-wrap">
                <span>{transformCount} Transformation</span>
                <span>{transcriptCount} Transkript{transcriptCount !== 1 ? 'e' : ''}</span>
                <span>{binaryCount} Binaries{loadingFragments ? ' (lädt...)' : ''}</span>
                {mediaCount > 0 && <span>{mediaCount} Media</span>}
              </span>
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Analysiert</td>
            <td className="py-1">{new Date(state.analysisTimestamp).toLocaleString('de-DE')}</td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Freshness</td>
            <td className="py-1">
              <span className={`font-medium ${freshnessLabel.color}`}>
                {freshness.apiLoading ? 'Wird geprüft…' : freshnessLabel.label}
              </span>
              {/* API-basierte Issue-Anzahl (hat Vorrang über Atom-staleCount) */}
              {freshness.apiIssueCount > 0 && freshness.apiArtifacts.length > 1 && (
                <span className="ml-1 text-muted-foreground">
                  ({freshness.apiIssueCount}/{freshness.apiArtifacts.length} abweichend)
                </span>
              )}
              {freshness.apiIssueCount === 0 && freshness.staleCount > 0 && freshness.artifacts.length > 1 && (
                <span className="ml-1 text-muted-foreground">
                  ({freshness.staleCount}/{freshness.artifacts.length} veraltet)
                </span>
              )}
            </td>
          </tr>
          <tr className="border-b">
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Quelle modifiedAt</td>
            <td className="py-1">
              {freshness.sourceModifiedAt
                ? freshness.sourceModifiedAt.toLocaleString('de-DE')
                : <span className="text-muted-foreground">—</span>}
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-3 text-muted-foreground whitespace-nowrap align-top">Twin updatedAt</td>
            <td className="py-1">
              {freshness.twinUpdatedAt
                ? freshness.twinUpdatedAt.toLocaleString('de-DE')
                : <span className="text-muted-foreground">—</span>}
              {freshness.diffMs !== null && freshness.diffMs !== 0 && (
                <span className="ml-2 text-muted-foreground">
                  (Diff: {freshness.diffMs > 0 ? '+' : ''}{Math.round(freshness.diffMs / 1000)}s)
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Einzelne Tabelle: Alle Artefakte aus MongoDB (Markdown + Binaries) */}
      {activeLibraryId && (
        <div>
          <div className="text-xs font-medium mb-2">Artefakte in MongoDB</div>
          <ShadowTwinArtifactsTable
            libraryId={activeLibraryId}
            sourceId={selectedFile.id}
            artifacts={artifacts}
            filesystemDeleted={false}
          />
        </div>
      )}

      {/* Pro-Artefakt Freshness-Vergleich: MongoDB vs. Storage Timestamps */}
      {activeLibraryId && (
        <FreshnessComparisonPanel
          libraryId={activeLibraryId}
          sourceId={selectedFile.id}
          parentId={selectedFile.parentId}
        />
      )}
    </div>
  );
} 