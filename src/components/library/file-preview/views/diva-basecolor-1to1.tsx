'use client'

/**
 * @fileoverview Inline-Anzeige eines Bildes bei physisch 1:1 (Stufe 3 Update 2 — UI).
 *
 * @description
 * Rendert ein <img> bei der CSS-Pixel-Breite, die seiner physischen
 * cm-Groesse entspricht (Standard-CSS-Annahme: 96 px/inch). So sieht
 * das Original am Bildschirm in der gleichen physischen Groesse aus,
 * wie es das LLM "sieht" — und der LLM-Crop (immer 4 cm) ist immer
 * ein fester kleiner Quadrat (~151 CSS-px).
 *
 * Der Container ist scrollbar; bei groesseren Originalen erscheinen
 * Scrollbalken statt das Bild herunterzuskalieren. Optionaler Click-
 * Handler oeffnet die Vollbild-Ansicht.
 *
 * Reine Praesentations-Komponente — laedt nichts selbst.
 */

import * as React from 'react'

/** CSS-Pixel pro Inch (Browser-Standard). */
const CSS_DPI = 96

/** Konvertiert cm → CSS-Pixel (gerundet). */
function cmToCssPx(cm: number): number {
  return Math.round((cm * CSS_DPI) / 2.54)
}

interface DivaBasecolor1to1Props {
  /** Bild-Quelle (Object-URL oder absolute URL). */
  src: string
  /** Physische Breite des Bildinhalts in cm (bestimmt CSS-Breite). */
  contentWidthCm: number
  /** Physische Hoehe des Bildinhalts in cm. */
  contentHeightCm: number
  /** Alt-Text fuer das Bild. */
  alt: string
  /** Klick-Handler — Wrapper zeigt cursor-zoom-in, wenn gesetzt. */
  onClick?: () => void
  /** Container-Hoehe in CSS-px (Default 320). */
  containerHeightPx?: number
}

export function DivaBasecolor1to1({
  src,
  contentWidthCm,
  contentHeightCm,
  alt,
  onClick,
  containerHeightPx = 320,
}: DivaBasecolor1to1Props) {
  const widthCssPx = cmToCssPx(contentWidthCm)
  const heightCssPx = cmToCssPx(contentHeightCm)
  const isClickable = onClick !== undefined

  return (
    <div
      className="relative overflow-auto rounded border bg-muted/30"
      style={{ height: `${containerHeightPx}px` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={onClick}
        className={isClickable ? 'cursor-zoom-in' : undefined}
        style={{
          width: `${widthCssPx}px`,
          height: `${heightCssPx}px`,
          maxWidth: 'none',
          display: 'block',
        }}
      />
    </div>
  )
}

/** Helfer fuer Container, die selbst keine cm haben (z.B. Supplier-Preview). */
export function divaCmToCssPx(cm: number): number {
  return cmToCssPx(cm)
}
