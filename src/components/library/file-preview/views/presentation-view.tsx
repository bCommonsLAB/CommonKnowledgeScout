'use client';

/**
 * file-preview/views/presentation-view.tsx
 *
 * Detail-View fuer Praesentations-Dateien (.ppt, .pptx, ...). Reicht
 * lediglich an das `DocumentPreview` weiter, das die volle Phasen-UI
 * fuer praesentationsbasierte Dokumente bereitstellt (eigener Workflow,
 * nicht der Standard-5-Tab-Switch).
 *
 * Aus `file-preview.tsx` PreviewContent-Switch (case 'presentation')
 * ausgegliedert (Welle 3-II-a Phase 2d, Schritt 3/4).
 *
 * Diese View ist bewusst eine Mini-Komponente: sie aenderlt nichts an
 * der Logik, sondern macht den Switch-Composer einheitlich
 * "ein Case = eine View-Komponente".
 *
 * Verwendet das gemeinsame `PreviewViewProps`-Bundle aus `./view-props`.
 */

import * as React from 'react'
import { DocumentPreview } from '@/components/library/document-preview'
import type { PreviewViewProps } from './view-props'

export function PresentationView(props: PreviewViewProps) {
  const { provider, activeLibraryId, onRefreshFolder } = props
  return (
    <DocumentPreview
      provider={provider}
      activeLibraryId={activeLibraryId}
      onRefreshFolder={onRefreshFolder}
    />
  )
}
