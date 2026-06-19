export const runtime = 'edge';

// Proxy for Celestrak TLE data — avoids CORS and caches at the edge for 1 hour
export async function GET() {
  try {
    const res = await fetch(
      'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=TLE',
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return new Response('upstream error', { status: 502 });
    const text = await res.text();
    return new Response(text, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch {
    return new Response('failed to fetch TLE data', { status: 502 });
  }
}
