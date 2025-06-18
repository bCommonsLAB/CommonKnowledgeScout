'use client';

import * as React from 'react';
import { useAtom } from 'jotai';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronUp, RefreshCw, Maximize2, Minimize2, Copy } from 'lucide-react';
import { debugStateAtom, toggleComponentAtom, toggleAreaAtom, clearLogsAtom, addLogAtom } from '@/atoms/debug-atom';
import { cn } from '@/lib/utils';
import { subscribeToLogs } from '@/lib/debug/logger';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { toast } from 'sonner';
import { libraryAtom, activeLibraryAtom, activeLibraryIdAtom, currentFolderIdAtom } from '@/atoms/library-atom';
import { useStorage } from '@/contexts/storage-context';
import { StorageItem } from '@/lib/storage/types';
import { ClientLibrary } from '@/types/library';

interface SystemInfo {
  userInfo: any;
  libraries: any;
  loading: { user: boolean; libraries: boolean };
  error: { user: string | null; libraries: string | null };
}

export default function DebugFooter() {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isFullHeight, setIsFullHeight] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'performance' | 'system'>('performance');

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
      setAddLog(entry);
    });
    return unsubscribe;
  }, [setAddLog]);

  // Komponenten und Areas für Filter
  const components = React.useMemo(() => {
    const componentSet = new Set<string>();
    debugState.logs.forEach(log => componentSet.add(log.component));
    return Array.from(componentSet).sort();
  }, [debugState.logs]);

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
    const createDetailsKey = (details: Record<string, any> | undefined): string => {
      if (!details) return '';
      
      // Sortiere Keys für konsistente Reihenfolge
      const sortedKeys = Object.keys(details).sort();
      
      // Erstelle ein normalisiertes Objekt
      const normalizedDetails = sortedKeys.reduce((acc, key) => {
        const value = details[key];
        // Rekursiv für verschachtelte Objekte
        acc[key] = typeof value === 'object' && value !== null
          ? createDetailsKey(value)
          : value;
        return acc;
      }, {} as Record<string, any>);
      
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
          } catch (e) {
            // Behalte den originalen Zeitstempel bei Fehler
            console.warn('Ungültiger Zeitstempel:', log.timestamp);
          }

          const { isDuplicate, ...logData } = log;
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
    <div 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t",
        !isExpanded && "h-8",
        isExpanded && !isFullHeight && "h-72",
        isExpanded && isFullHeight && "h-[calc(100vh-64px)]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-8 border-b">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          {isExpanded && (
            <>
              <span className="text-sm font-medium">Debug Panel</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsFullHeight(!isFullHeight)}
              >
                {isFullHeight ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>
        {isExpanded && (
          <div className="flex items-center space-x-2">
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
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex flex-col h-full overflow-hidden">
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
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'performance' | 'system')} className="flex-1 flex flex-col overflow-hidden">
                  <div className="border-b px-2 flex-shrink-0">
                    <TabsList className="h-7">
                      <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
                      <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
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
                                  let value = column === 'remarks' 
                                    ? log.remarks
                                    : column === 'timestamp'
                                      ? log.timestamp.split('T')[1]?.split('.')[0] || log.timestamp
                                      : column.startsWith('details.') 
                                        ? log.details?.[column.split('.')[1]] 
                                        : (log as any)[column];
                                  
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
                      </div>
                      <ScrollBar orientation="vertical" />
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
} 