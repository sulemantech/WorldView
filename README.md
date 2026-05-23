# WORLDVIEW — 4D OSINT Geospatial Command Center

A real-time geospatial intelligence platform built with Next.js and Cesium.js.
Deploy to Vercel in one click.

## Features

- **3D Globe** — Cesium.js with natural Earth imagery
- **Live Mode** — Simulated real-time data updates every 2 seconds
- **Playback Mode** — Operation Epic Fury scenario timeline (T0 to T+120min)
- **Data Layers**: Commercial flights, Military flights, Satellites, Ships, GPS jamming, No-fly zones, Events
- **AI Fusion Engine** sidebar with OSINT activity stream
- **Click tooltips** on any entity for full metadata

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

```bash
npx vercel --prod
```
Or connect your GitHub repo to Vercel — it auto-deploys on push.

## Operation Epic Fury Scenario

Switch to **PLAYBACK MODE** and press **PLAY** to watch:
- **T+0min**: Strike on Isfahan nuclear facility
- **T+15min**: Iran declares no-fly zone
- **T+30min**: 5 commercial flights divert
- **T+45min**: GPS jamming expands across Persian Gulf
- **T+60min**: Retaliatory strike on Al Udeid AB, Qatar
- **T+90min**: Strait of Hormuz closure

Use speed multiplier (1×/5×/15×/30×) and scrub the timeline slider freely.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Cesium.js 1.122** (loaded via CDN, assets in /public/cesium)
- **Tailwind CSS** for layout utilities
- No backend required — all data is client-side generated

## Notes

- Cesium requires COOP/COEP headers (set in `vercel.json` and `next.config.ts`)
- All flight/ship/satellite data is simulated mock data
- For production OSINT, replace data generators with real ADS-B/AIS API feeds
