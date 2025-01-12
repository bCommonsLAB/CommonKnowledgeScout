import { Metadata } from "next"
import MusicPage from "@/components/music/page"

export const metadata: Metadata = {
  title: "Music",
  description: "Music streaming and playlist management.",
}

/**
 * Music Route
 * 
 * This page displays the music interface with playlists and albums.
 * It serves as the main music streaming interface.
 */
export default function Page() {
  return <MusicPage />
} 