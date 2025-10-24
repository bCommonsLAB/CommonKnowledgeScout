import { NextRequest, NextResponse } from 'next/server';
import { getVimeoConfig } from '@/lib/env';

interface VimeoTextTrack {
  id?: string;
  language?: string;
  kind?: string;
  name?: string;
  link?: string;
  url?: string;
}

// POST /api/video/transcript
// Body: { videoId?: string; playerUrl?: string; language?: string }
// Liefert, wenn möglich, die VTT-Untertitel/Transkript-Datei als Text
export async function POST(req: NextRequest) {
  try {
    const { videoId, playerUrl, language } = await req.json();
    const id = typeof videoId === 'string' && videoId.trim()
      ? videoId.trim()
      : (() => {
          if (typeof playerUrl !== 'string') return '';
          const fromPlayer = playerUrl.match(/player\.vimeo\.com\/video\/(\d+)/);
          if (fromPlayer) return fromPlayer[1];
          const fromPage = playerUrl.match(/vimeo\.com\/(\d+)/);
          if (fromPage) return fromPage[1];
          return '';
        })();
    if (!id) {
      return NextResponse.json({ status: 'error', error: { code: 'MISSING_ID', message: 'videoId oder playerUrl erforderlich' } }, { status: 400 });
    }

    const { accessToken } = getVimeoConfig();
    if (!accessToken) {
      return NextResponse.json({ status: 'error', error: { code: 'NO_TOKEN', message: 'VIMEO_ACCESS_TOKEN nicht gesetzt' } }, { status: 400 });
    }

    // 1) Verfügbare Texttracks laden
    const ttRes = await fetch(`https://api.vimeo.com/videos/${id}/texttracks`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.vimeo.*+json;version=3.4'
      }
    });
    if (!ttRes.ok) {
      const body = await ttRes.text().catch(() => '');
      return NextResponse.json({ status: 'error', error: { code: 'API_ERROR', message: `Vimeo texttracks ${ttRes.status} ${ttRes.statusText}`, details: body.slice(0, 500) } }, { status: 502 });
    }
    const json = await ttRes.json();
    const data: VimeoTextTrack[] = Array.isArray(json?.data) ? (json.data as VimeoTextTrack[]) : [];
    if (data.length === 0) {
      return NextResponse.json({ status: 'error', error: { code: 'NO_TEXTTRACKS', message: 'Keine Texttracks verfügbar' } }, { status: 404 });
    }

    // Bevorzugt gewünschte Sprache, sonst erstes Captions/Subtitles
    const pick = (tracks: VimeoTextTrack[]): VimeoTextTrack => {
      if (language) {
        const lang = String(language).toLowerCase();
        const byLang = tracks.find(t => (t?.language || '').toLowerCase() === lang);
        if (byLang) return byLang;
      }
      const kinds = ['subtitles', 'captions'];
      for (const k of kinds) {
        const t = tracks.find(tt => (tt?.kind || '').toLowerCase() === k);
        if (t) return t;
      }
      return tracks[0];
    };

    const track = pick(data);
    const link: string | undefined = track?.link || track?.url;
    if (!link) {
      return NextResponse.json({ status: 'error', error: { code: 'NO_LINK', message: 'Kein Link zum Transkript gefunden' }, data: { tracks: data } }, { status: 404 });
    }

    // 2) VTT laden
    const vttRes = await fetch(link, { headers: { 'Accept': 'text/vtt,*/*' } });
    if (!vttRes.ok) {
      const body = await vttRes.text().catch(() => '');
      return NextResponse.json({ status: 'error', error: { code: 'VTT_FETCH_FAILED', message: `VTT ${vttRes.status} ${vttRes.statusText}`, details: body.slice(0, 500) } }, { status: 502 });
    }
    const vtt = await vttRes.text();

    return NextResponse.json({ status: 'success', data: { vtt, track: { id: track?.id, language: track?.language, kind: track?.kind, name: track?.name, link } } });
  } catch (e) {
    return NextResponse.json({ status: 'error', error: { code: 'INTERNAL', message: e instanceof Error ? e.message : 'Unbekannter Fehler' } }, { status: 500 });
  }
}


