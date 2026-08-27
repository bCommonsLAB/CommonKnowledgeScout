'use client'

/**
 * @fileoverview Verdrahtet den App-Logger mit `@ks/viewers` (Welle M2b, R1).
 *
 * @description
 * `@ks/viewers` definiert nur, WAS es vom Logger braucht (`ViewerLogger`), und
 * greift nicht mehr in die App zurueck — sonst waere das Paket nicht
 * eigenstaendig einbettbar (Modul-Landkarte §4). Diese Bruecke reicht die
 * App-Implementierung `FileLogger` einmal herein.
 *
 * Die Zuweisung geschieht auf MODUL-Ebene, nicht in einem Effect: Sie muss
 * stehen, bevor die erste Viewer-Funktion laeuft. Ein Effect wuerde erst nach
 * dem ersten Render feuern und die ersten Debug-Meldungen verschlucken.
 *
 * Die Komponente rendert nichts — sie macht die Verdrahtung in der
 * Provider-Kette von `layout.tsx` sichtbar. Ohne sie loggt das Paket still
 * weiter (No-op-Default), die Anwendung bleibt funktionsfaehig.
 */

import { setViewerLogger } from '@ks/viewers'
import { FileLogger } from '@/lib/debug/logger'

setViewerLogger(FileLogger)

export function ViewerLoggerBridge() {
  return null
}
