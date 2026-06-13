"use client"

/**
 * TestResultTable — Anzeige der Storage-Test-Logs.
 * Extrahiert aus storage-form.tsx (Welle 3-IV-UX-3b), damit Wizard
 * und Zusammenfassung dieselbe Tabelle nutzen.
 */

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Info } from "lucide-react"
import { toast } from "sonner"
import type { TestLogEntry } from "./hooks/use-storage-form"

export function TestResultTable({ testResults }: { testResults: TestLogEntry[] }) {
  if (testResults.length === 0) {
    return <p className="text-muted-foreground">Testergebnisse werden geladen...</p>;
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      <table className="w-full border-collapse table-fixed">
        <thead className="bg-muted/50">
          <tr className="text-xs border-b">
            <th className="text-left p-2 font-medium w-[90px]">Datum/Zeit</th>
            <th className="text-left p-2 font-medium w-[120px]">Funktion</th>
            <th className="text-left p-2 font-medium">Beschreibung</th>
            <th className="text-left p-2 font-medium w-[80px]">Status</th>
            <th className="text-left p-2 font-medium w-[60px]">Details</th>
          </tr>
        </thead>
        <tbody>
          {testResults
            .filter(result => result.step !== "API-Aufruf")
            .map((result, index) => (
              <tr
                key={index}
                className={`text-xs border-b hover:bg-muted/20 ${
                  result.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                  result.status === 'success' ? 'bg-green-50 dark:bg-green-900/20' : ''
                }`}
              >
                <td className="p-2">
                  {result.timestamp && !isNaN(Date.parse(result.timestamp))
                    ? new Date(result.timestamp).toLocaleTimeString()
                    : ''}
                </td>
                <td className="p-2">{result.step}</td>
                <td className="p-2 overflow-hidden text-ellipsis whitespace-nowrap" title={result.message}>
                  {result.message}
                </td>
                <td className="p-2">
                  <Badge
                    variant={
                      result.status === 'error' ? 'destructive' :
                      result.status === 'success' ? 'default' : 'secondary'
                    }
                  >
                    {result.status}
                  </Badge>
                </td>
                <td className="p-2">
                  {result.details && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => {
                        toast.info("Details", {
                          description: typeof result.details === 'string'
                            ? result.details
                            : JSON.stringify(result.details),
                        });
                      }}
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
