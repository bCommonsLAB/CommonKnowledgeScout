import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";

interface EventSummaryProps {
  summary: string;
  videoUrl?: string;
}

/**
 * Komponente zur Anzeige der Event-Zusammenfassung
 * Zeigt Markdown-Inhalt und optional eingebettetes Video
 */
export function EventSummary({ summary, videoUrl }: EventSummaryProps) {
  if (!summary) {
    return null;
  }

  return (
    <Card className="p-6">
      <h2 className="text-2xl font-bold mb-6">Summary</h2>
      
      {/* Video Embed */}
      {videoUrl && (
        <div className="mb-6 aspect-video rounded-lg overflow-hidden bg-muted">
          <iframe
            src={videoUrl}
            className="w-full h-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title="Event Video"
          />
        </div>
      )}

      {/* Markdown Content */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    </Card>
  );
}

