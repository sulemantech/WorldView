export const runtime = 'edge';

import Anthropic from '@anthropic-ai/sdk';

// Static fallback messages used when no API key is configured
const FALLBACK: { type: string; text: string }[] = [
  { type: "system",    text: "ARIA online — sensor fusion active across all domains" },
  { type: "flight",   text: "ADS-B feed nominal — OpenSky Network reporting live contacts" },
  { type: "ship",     text: "AIS feed nominal — AISstream.io reporting live vessel positions" },
  { type: "satellite",text: "Celestrak TLE data loaded — orbital propagation active" },
  { type: "gps",      text: "GPS constellation integrity nominal — PNT accuracy within spec" },
  { type: "ai",       text: "Pattern-of-life baseline established — anomaly detection running" },
  { type: "flight",   text: "Commercial traffic density elevated over Persian Gulf corridor" },
  { type: "ship",     text: "Tanker traffic through Strait of Hormuz within normal parameters" },
  { type: "ai",       text: "No significant threat indicators detected — continuing surveillance" },
];

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ── No key: stream static fallback messages ───────────────────────────────
  if (!apiKey) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const msg of FALLBACK) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
          await new Promise(r => setTimeout(r, 300));
        }
        controller.enqueue(encoder.encode('data: {"done":true}\n\n'));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  // ── Parse world-state context from request body ───────────────────────────
  let flightCount = 50, shipCount = 13, satCount = 100, jamZones = 4, threatLevel = 'YELLOW';
  try {
    const body = await req.json() as Record<string, unknown>;
    if (typeof body.flightCount  === 'number') flightCount  = body.flightCount;
    if (typeof body.shipCount    === 'number') shipCount    = body.shipCount;
    if (typeof body.satCount     === 'number') satCount     = body.satCount;
    if (typeof body.jamZones     === 'number') jamZones     = body.jamZones;
    if (typeof body.threatLevel  === 'string') threatLevel  = body.threatLevel;
  } catch { /* use defaults */ }

  // ── Stream Claude response as SSE ─────────────────────────────────────────
  const client  = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const responseStream = new ReadableStream({
    async start(controller) {
      const emit = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        const stream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 600,
          system: `You are ARIA, AI Reconnaissance & Intelligence Aggregator for the WORLDVIEW OSINT Command Center.
Current operational picture (live data):
- ADS-B flight tracks: ${flightCount} (OpenSky Network)
- AIS vessel contacts: ${shipCount} (AISstream.io)
- Satellites indexed: ${satCount} (Celestrak TLE)
- GPS jamming zones: ${jamZones} active
- Threat level: ${threatLevel}

Output exactly 9 intelligence reports, one per line, each as valid JSON only — no other text:
{"type":"TYPE","text":"MESSAGE"}

TYPE must be one of: ai, satellite, flight, ship, gps, system
Rules: tactical military/OSINT language, 10-20 words, plausible callsigns/coords/bearings.`,
          messages: [{ role: 'user', content: 'Generate ARIA intelligence feed.' }],
        });

        let buf = '';
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            buf += event.delta.text;
            const nl = buf.lastIndexOf('\n');
            if (nl === -1) continue;
            const complete = buf.slice(0, nl);
            buf = buf.slice(nl + 1);
            for (const line of complete.split('\n')) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const msg = JSON.parse(trimmed) as Record<string, unknown>;
                if (typeof msg.type === 'string' && typeof msg.text === 'string') emit(msg);
              } catch { /* partial line, skip */ }
            }
          }
        }

        // Flush any remaining buffer
        if (buf.trim()) {
          try {
            const msg = JSON.parse(buf.trim()) as Record<string, unknown>;
            if (typeof msg.type === 'string' && typeof msg.text === 'string') emit(msg);
          } catch { /* ignore */ }
        }

        emit({ done: true });
      } catch {
        emit({ type: 'system', text: 'ARIA: intelligence feed interrupted — reconnecting' });
        emit({ done: true });
      }

      controller.close();
    },
  });

  return new Response(responseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
