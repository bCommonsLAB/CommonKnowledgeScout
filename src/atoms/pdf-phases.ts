"use client";

import { atom } from "jotai";

export type PdfPhase = 1 | 2 | 3;

export const activePdfPhaseAtom = atom<PdfPhase>(1);



