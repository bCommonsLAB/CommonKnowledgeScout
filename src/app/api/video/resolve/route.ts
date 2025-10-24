import { NextRequest, NextResponse } from 'next/server';
import { getVimeoConfig } from '@/lib/env';

// POST /api/video/resolve
// Body: { url: string }
// Zweck: Player-URL (z. B. Vimeo) serverseitig in Medien-URL (mp4/HLS) auflösen, um CORS zu vermeiden
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ status: 'error', error: { code: 'MISSING_URL', message: 'url ist erforderlich' } }, { status: 400 });
    }

    // Vimeo Player URL → API (mit Token) oder /config (Fallback)
    const match = url.match(/player\.vimeo\.com\/video\/(\d+)/);
    if (match) {
      const id = match[1];
      const { accessToken } = getVimeoConfig();
      let media: string | null = null;
      const sources: { progressive: string[]; hls: string[]; apiFiles: string[] } = {
        progressive: [],
        hls: [],
        apiFiles: []
      };
      if (accessToken) {
        const apiRes = await fetch(`https://api.vimeo.com/videos/${id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.vimeo.*+json;version=3.4'
          }
        });
        if (apiRes.ok) {
          const jd = await apiRes.json();
          const files = jd?.download || jd?.files || [];
          if (Array.isArray(files) && files.length > 0) {
            for (const f of files) {
              const u = f?.link || f?.url;
              if (typeof u === 'string') sources.apiFiles.push(u);
            }
            const last = files[files.length - 1];
            media = last?.link || last?.url || null;
          }
        }
      }
      if (!media) {
        const cfgUrl = `https://player.vimeo.com/video/${id}/config`;
        const res = await fetch(cfgUrl, {
          redirect: 'follow',
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
            'Referer': `https://player.vimeo.com/video/${id}`,
            'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          return NextResponse.json({ status: 'error', error: { code: 'FETCH_FAILED', message: `Vimeo config ${res.status} ${res.statusText}`, details: text?.slice(0, 500) } }, { status: 502 });
        }
        const cfg = await res.json();
        const progressive = cfg?.request?.files?.progressive;
        if (Array.isArray(progressive) && progressive.length > 0) {
          for (const p of progressive) {
            if (typeof p?.url === 'string') sources.progressive.push(p.url);
          }
          media = progressive[progressive.length - 1]?.url || progressive[0]?.url || null;
        }
        if (!media) {
          const hls = cfg?.request?.files?.hls?.cdns;
          const vals = hls ? Object.values(hls) as Array<{ url?: string }> : [];
          for (const v of vals) if (typeof v?.url === 'string') sources.hls.push(v.url);
          media = sources.hls[0] || null;
        }
      }
      if (!media) {
        return NextResponse.json({ status: 'error', error: { code: 'NO_MEDIA', message: 'Keine Medien-URL ermittelbar' }, data: { player_url: url, sources } }, { status: 404 });
      }
      return NextResponse.json({ status: 'success', data: { media_url: media, media_urls: Array.from(new Set([media, ...sources.progressive, ...sources.hls, ...sources.apiFiles].filter(Boolean))), player_url: url, sources } });
    }

    return NextResponse.json({ status: 'error', error: { code: 'UNSUPPORTED_URL', message: 'URL-Typ wird nicht unterstützt' } }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ status: 'error', error: { code: 'INTERNAL', message: e instanceof Error ? e.message : 'Unbekannter Fehler' } }, { status: 500 });
  }
}


