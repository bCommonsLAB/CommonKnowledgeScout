"use client";

import * as React from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export interface KeyValueRow {
  keyName: string;
  value: string;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  emptyLabel?: string;
}

export function KeyValueTable({ rows, emptyLabel = 'Keine Einträge' }: KeyValueTableProps) {
  if (!rows || rows.length === 0) return <div className="text-xs text-muted-foreground">{emptyLabel}</div>
  return (
    <div className="overflow-auto">
      <Table className="w-full text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="w-48">Feld</TableHead>
            <TableHead>Wert</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.keyName}>
              <TableCell className="font-medium align-top">{r.keyName}</TableCell>
              <TableCell className="align-top whitespace-pre-wrap break-words">{r.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}





























