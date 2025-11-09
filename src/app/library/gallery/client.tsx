"use client";

import { useEffect } from "react";
import { useAtom } from "jotai";
import { activeLibraryIdAtom } from "@/atoms/library-atom";
import EnsureLibrary from "./ensure-library";
import { Library as LibraryUI } from "@/components/library/library";

interface GalleryClientProps {
	/**
	 * Optional: Erzwingt die aktive Library-ID (z.B. von der öffentlichen Explore-Seite).
	 * Wenn gesetzt, wird diese ID in den globalen Zustand und in localStorage geschrieben.
	 */
	libraryIdProp?: string;
}

export default function GalleryClient({ libraryIdProp }: GalleryClientProps) {
	const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom);

	// Falls eine Library-ID von außen übergeben wird, setze sie als aktiv
	useEffect(() => {
		if (!libraryIdProp) return;
		setActiveLibraryId(libraryIdProp);
		try {
			localStorage.setItem("activeLibraryId", libraryIdProp);
		} catch {
			// Ignorieren: localStorage kann in einigen Umgebungen gesperrt sein
		}
	}, [libraryIdProp, setActiveLibraryId]);

	return (
		<div className="h-full min-h-0 flex flex-col">
			{/* Sorgt dafür, dass die libraryId als Query-Param vorhanden ist (für Deep-Links/Reloads) */}
			<EnsureLibrary paramKey="libraryId" />
			<div className="flex-1 min-h-0">
				<LibraryUI />
			</div>
		</div>
	);
}

