'use client';

/**
 * file-list/sortable-header-cell.tsx
 *
 * Sortierbare Kopfzelle der Datei-Liste.
 *
 * Aus `file-list.tsx` extrahiert (Welle 3-I, Schritt 4b).
 */

import * as React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { SortField, SortOrder } from './list-utils';

interface SortableHeaderCellProps {
  label: string;
  field: SortField;
  currentSortField: SortField;
  currentSortOrder: SortOrder;
  onSort: (field: SortField) => void;
}

export const SortableHeaderCell = React.memo(function SortableHeaderCell({
  label,
  field,
  currentSortField,
  currentSortOrder,
  onSort,
}: SortableHeaderCellProps) {
  const isActive = currentSortField === field;

  return (
    <button
      onClick={() => onSort(field)}
      className="flex items-center gap-1 hover:text-foreground"
    >
      <span>{label}</span>
      {isActive &&
        (currentSortOrder === 'asc' ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  );
});
