"use client";

import { atom } from "jotai";

export const currentPdfPageAtom = atom<number>(1);

// Map von Seite -> Markdown-Offset (Zeichenindex) oder Element-ID
export const pageToMarkdownAnchorAtom = atom<Record<number, string>>({});



