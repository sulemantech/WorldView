"use client";
// ============================================================
// WORLDVIEW — CommandCenter
// MapLibre GL JS + Deck.gl GPU-accelerated map renderer
// ============================================================

import { useRef, useMemo, useState, useCallback, useLayoutEffect, useEffect } from "react";
import Map, { MapRef, useControl } from "react-map-gl/maplibre";
import { MapboxOverlay } from "@deck.gl/mapbox";
import type { PickingInfo } from "@deck.gl/core";
import { IconLayer, ScatterplotLayer, PolygonLayer, TextLayer, PathLayer } from "@deck.gl/layers";
import "maplibre-gl/dist/maplibre-gl.css";

import type {
  FlightTrack, Ship, Satellite, GpsJamZone, NoFlyZone, EventMarker,
} from "@/lib/dataGenerators";
import type { LayerVisibility } from "@/lib/cesiumHelpers";

// ─── Types ────────────────────────────────────────────────────────────────────

type RGBA = [number, number, number, number];
type MapStyleKey = "dark" | "satellite" | "street" | "terrain";

interface CommandCenterProps {
  flights: FlightTrack[];
  ships: Ship[];
  satellites: Satellite[];
  gpsZones: GpsJamZone[];
  noFlyZones: NoFlyZone[];
  events: EventMarker[];
  layers: LayerVisibility;
  onTooltip: (
    t: { x: number; y: number; title: string; rows: [string, string][] } | null
  ) => void;
  onEntityClick: (type: string, id: string) => void;
}

// ─── Map Styles ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MAP_STYLES: Record<MapStyleKey, any> = {
  dark:    "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  street:  "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  satellite: {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Esri, Maxar, GeoEye",
      },
    },
    layers: [{ id: "esri-sat", type: "raster", source: "esri" }],
  },
  terrain: {
    version: 8,
    sources: {
      esri: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Esri, HERE, Garmin",
      },
    },
    layers: [{ id: "esri-topo", type: "raster", source: "esri" }],
  },
};

const STYLE_BTNS: { key: MapStyleKey; label: string }[] = [
  { key: "satellite", label: "SAT" },
  { key: "dark",      label: "DRK" },
  { key: "street",    label: "STR" },
  { key: "terrain",   label: "TRN" },
];

// ─── SVG Icon Factory (white shapes → deck.gl tints via getColor + mask) ─────
// mask:true uses the texture alpha channel as an opacity mask; white = full color.
// fill-rule="evenodd" lets inner sub-paths cut transparent holes in outer shapes.

type IconDef = {
  url: string; width: number; height: number;
  anchorX: number; anchorY: number; mask: boolean;
};

function icon(paths: string, size = 80, vb = "-5 -5 74 74"): IconDef {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${vb}">${paths}</svg>`;
  return {
    url: `data:image/svg+xml;base64,${btoa(svg)}`,
    width: size, height: size,
    anchorX: size / 2, anchorY: size / 2,
    mask: true,
  };
}

// ── Full-circle helper (two semicircular arcs for reliable SVG rendering) ─────
const circ = (cx: number, cy: number, r: number) =>
  `M${cx - r},${cy} A${r},${r} 0 1,0 ${cx + r},${cy} A${r},${r} 0 1,0 ${cx - r},${cy} Z`;

// ── All icons point UP (north). deck.gl rotates clockwise via getAngle = heading.

const ICONS: Record<string, IconDef> = {

  // ─── COMMERCIAL AIRLINER ──────────────────────────────────────────────────
  // Top-down: fuselage + swept wings.  All points kept ≥10 units from 0/64
  // boundary so wing-tips stay clear of the billboard edge at any rotation.
  commercial: icon(`
    <ellipse cx="32" cy="32" rx="4.5" ry="24" fill="white"/>
    <ellipse cx="32" cy="9"  rx="3.5" ry="5"  fill="white"/>
    <polygon points="28,24 10,46 14,52 28,37" fill="white"/>
    <polygon points="36,24 54,46 50,52 36,37" fill="white"/>
    <polygon points="28,52 17,59 19,62 28,56" fill="white"/>
    <polygon points="36,52 47,59 45,62 36,56" fill="white"/>
    <rect x="30" y="52" width="4" height="10" rx="1.5" fill="white"/>
  `),

  // ─── MILITARY FIGHTER JET ─────────────────────────────────────────────────
  // Delta-wing jet: all extreme points pulled ≥10 units from the 0/64 edges.
  military: icon(`
    <ellipse cx="32" cy="28" rx="3"   ry="21" fill="white"/>
    <ellipse cx="32" cy="8"  rx="2.5" ry="5"  fill="white"/>
    <polygon points="30,20 10,52 28,48" fill="white"/>
    <polygon points="34,20 54,52 36,48" fill="white"/>
    <ellipse cx="27" cy="51" rx="4" ry="5" fill="white"/>
    <ellipse cx="37" cy="51" rx="4" ry="5" fill="white"/>
    <polygon points="30,24 15,30 17,34 30,28" fill="white"/>
    <polygon points="34,24 49,30 47,34 34,28" fill="white"/>
  `),

  // ─── OIL / LNG TANKER ─────────────────────────────────────────────────────
  // Very long narrow hull, smooth deck, bridge at stern, tank separators.
  tanker: icon(`
    <path fill-rule="evenodd" fill="white" d="
      M32,4 C39,5 43,13 43,22 L43,50 C43,57 38,62 32,62
             C26,62 21,57 21,50 L21,22 C21,13 25,5 32,4 Z
      M21,28 L43,28 L43,29.5 L21,29.5 Z
      M21,40 L43,40 L43,41.5 L21,41.5 Z
    "/>
    <rect x="27" y="52" width="10" height="8" rx="1" fill="white"/>
    <rect x="31" y="43" width="2" height="12" fill="white"/>
    <rect x="28" y="43" width="8" height="2"  fill="white"/>
  `),

  // ─── CARGO / CONTAINER SHIP ───────────────────────────────────────────────
  // Wider boxy hull, container grid on deck, crane tower.
  cargo: icon(`
    <path d="M32,6 L43,11 L45,19 L45,54 Q45,62 32,63 Q19,62 19,54 L19,19 L21,11 Z"
          fill="white"/>
    <path fill-rule="evenodd" fill="white" d="
      M19,20 L45,20 L45,52 L19,52 Z
      M19,29 L45,29 L45,30.5 L19,30.5 Z
      M19,39 L45,39 L45,40.5 L19,40.5 Z
      M32,20 L32,52 L33.5,52 L33.5,20 Z
    "/>
    <rect x="27" y="53" width="10" height="8" rx="1" fill="white"/>
    <rect x="30" y="44" width="4" height="12" fill="white"/>
    <rect x="28" y="44" width="8" height="2.5" fill="white"/>
  `),

  // ─── WARSHIP / DESTROYER ─────────────────────────────────────────────────
  // Narrow pointed hull fore and aft, bridge tower, radar mast, bow gun.
  warship: icon(`
    <path d="M32,3 C37,7 39,14 39,22 L39,52 C39,59 36,63 32,63
             C28,63 25,59 25,52 L25,22 C25,14 27,7 32,3 Z" fill="white"/>
    <rect x="28" y="25" width="8" height="16" rx="1" fill="white"/>
    <rect x="30" y="16" width="4" height="13" rx="1" fill="white"/>
    <rect x="31" y="9"  width="2" height="10" fill="white"/>
    <rect x="28" y="9"  width="8" height="2"  fill="white"/>
    <ellipse cx="32" cy="19" rx="5" ry="1.5" fill="white"/>
    <circle  cx="32" cy="20" r="3" fill="white"/>
  `),

  // ─── AIRCRAFT CARRIER ─────────────────────────────────────────────────────
  // Wide flat flight deck, angled deck stripe, island tower on starboard.
  // Island kept within x≤57, masts start at y≥9 — all points within safe
  // texture radius from center (32,32) to avoid billboard-edge clipping.
  carrier: icon(`
    <path fill-rule="evenodd" fill="white" d="
      M9,14 L55,14 L60,21 L56,58 L9,58 L4,21 Z
      M11,44 L49,30 L49,33 L11,47 Z
    "/>
    <rect x="44" y="9"  width="13" height="22" rx="2" fill="white"/>
    <rect x="48" y="9"  width="2.5" height="7" fill="white"/>
    <rect x="52" y="9"  width="2.5" height="7" fill="white"/>
    <rect x="46" y="9"  width="3"   height="8" fill="white"/>
    <ellipse cx="51" cy="30" rx="5" ry="2" fill="white"/>
  `),

  // ─── SATELLITE (generic / commercial) ────────────────────────────────────
  // Square body, two rectangular solar panel arrays with cell lines, sensor lens.
  satellite: icon(`
    <rect x="22" y="22" width="20" height="20" rx="2" fill="white"/>
    <path fill-rule="evenodd" fill="white" d="
      M5,25  L20,25 L20,39 L5,39  Z
      M6,27  L8,27  L8,37  L6,37  Z
      M10,27 L12,27 L12,37 L10,37 Z
      M14,27 L16,27 L16,37 L14,37 Z
      M17,27 L19,27 L19,37 L17,37 Z
    "/>
    <path fill-rule="evenodd" fill="white" d="
      M44,25 L59,25 L59,39 L44,39 Z
      M45,27 L47,27 L47,37 L45,37 Z
      M49,27 L51,27 L51,37 L49,37 Z
      M53,27 L55,27 L55,37 L53,37 Z
      M57,27 L58,27 L58,37 L57,37 Z
    "/>
    <path fill-rule="evenodd" fill="white" d="${circ(32, 32, 5)} ${circ(32, 32, 2)}"/>
  `),

  // ─── STRIKE EVENT ────────────────────────────────────────────────────────
  // Military target crosshair: two concentric rings + four arms.
  strike: icon(`
    <path fill-rule="evenodd" fill="white" d="
      ${circ(32, 32, 20)} ${circ(32, 32, 14)}
    "/>
    <path fill-rule="evenodd" fill="white" d="
      ${circ(32, 32, 9)} ${circ(32, 32, 4)}
    "/>
    <rect x="1"  y="30" width="13" height="4" fill="white"/>
    <rect x="50" y="30" width="13" height="4" fill="white"/>
    <rect x="30" y="1"  width="4" height="13" fill="white"/>
    <rect x="30" y="50" width="4" height="13" fill="white"/>
  `),

  // ─── EXPLOSION / DETONATION ───────────────────────────────────────────────
  // 12-point jagged starburst with bright center.
  explosion: icon(`
    <polygon points="
      32,2  36,22 46,8  40,26 58,20 46,34 62,34
      48,42 60,56 40,50 44,62 32,50 20,62 24,50
      4,56  16,42 2,34  18,34 8,20  26,26 18,8  28,22
    " fill="white"/>
    <circle cx="32" cy="32" r="10" fill="white"/>
  `),

  // ─── AIRSPACE CLOSURE ────────────────────────────────────────────────────
  // Warning triangle border with exclamation mark inside.
  closure: icon(`
    <path fill-rule="evenodd" fill="white" d="
      M32,3 L62,57 L2,57 Z
      M32,11 L56,53 L8,53 Z
    "/>
    <rect   x="29" y="22" width="6" height="17" rx="3" fill="white"/>
    <circle cx="32" cy="47" r="4"  fill="white"/>
  `),

  // ─── POLITICAL DECLARATION / NFZ NOTAM ───────────────────────────────────
  // Official document with text lines and a wax-seal ring.
  declaration: icon(`
    <path fill-rule="evenodd" fill="white" d="
      M11,5  L53,5  L53,59 L11,59 L11,5  Z
      M17,13 L47,13 L47,16 L17,16 Z
      M17,21 L47,21 L47,24 L17,24 Z
      M17,29 L47,29 L47,32 L17,32 Z
      M17,37 L36,37 L36,40 L17,40 Z
    "/>
    <path fill-rule="evenodd" fill="white" d="
      ${circ(30, 50, 9)} ${circ(30, 50, 5)}
    "/>
    <path fill-rule="evenodd" fill="white" d="
      ${circ(30, 50, 3)} ${circ(30, 50, 1)}
    "/>
  `),

  // ─── FLIGHT DIVERSION ────────────────────────────────────────────────────
  // Thick U-turn arrow indicating a rerouted flight path.
  diversion: icon(`
    <path d="
      M22,60 L22,32 C22,18 30,10 44,10 L56,10 L56,4
      L64,18 L56,32 L56,22 L44,22 C36,22 34,27 34,32
      L34,60 Z
    " fill="white"/>
    <polygon points="52,4 64,18 52,32" fill="white"/>
  `),
};

// ─── Deck.gl / MapLibre bridge ────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DeckGLOverlay({ layers, onHover, onClick }: { layers: any[]; onHover: any; onClick: any }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlay = useControl<any>(() => new MapboxOverlay({ interleaved: false }));
  // useLayoutEffect ensures setProps is called only after a committed render,
  // not during discarded concurrent-mode render passes, so layer toggles propagate reliably.
  useLayoutEffect(() => {
    overlay.setProps({ layers, onHover, onClick });
  });
  return null;
}

// ─── Camera button (outside CommandCenter to avoid ref-during-render lint) ────

function CamBtn({ label, title, onClick, small }: { label: string; title: string; onClick: () => void; small?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32, height: 32,
        background: "rgba(5,10,15,0.88)",
        border: "1px solid var(--border)",
        color: "var(--accent-cyan)",
        borderRadius: "3px",
        cursor: "pointer",
        fontSize: small ? "9px" : "16px",
        fontFamily: "var(--font-display)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = "rgba(0,212,255,0.12)";
        b.style.borderColor = "var(--accent-cyan)";
      }}
      onMouseLeave={e => {
        const b = e.currentTarget as HTMLButtonElement;
        b.style.background = "rgba(5,10,15,0.88)";
        b.style.borderColor = "var(--border)";
      }}
    >
      {label}
    </button>
  );
}

// ─── Color palette ────────────────────────────────────────────────────────────

const C: Record<string, RGBA> = {
  commercial:   [68,  136, 255, 230],
  diverted:     [255, 140, 0,   255],
  military:     [255, 51,  102, 245],
  tanker:       [255, 215, 0,   225],
  cargo:        [255, 170, 0,   220],
  warship:      [255, 102, 68,  235],
  carrier:      [255, 102, 68,  245],
  sat_com:      [0,   255, 157, 200],
  sat_spy:      [255, 51,  102, 230],
  sat_comms:    [155, 89,  255, 210],
  evt_critical: [255, 51,  102, 255],
  evt_high:     [255, 140, 0,   255],
  evt_medium:   [255, 215, 0,   235],
  evt_low:      [0,   212, 255, 210],
};

const BG: RGBA     = [5, 10, 15, 185];
const BG_PAD: [number, number, number, number] = [4, 2, 4, 2];
const evtC = (s: string): RGBA => C[`evt_${s}`] ?? C.evt_low;

const MAX_TRAIL = 20;

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CommandCenter({
  flights, ships, satellites, gpsZones, noFlyZones, events,
  layers: vis, onTooltip, onEntityClick,
}: CommandCenterProps) {
  const mapRef    = useRef<MapRef>(null);
  const trailsRef = useRef<Record<string, [number, number][]>>({});
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("dark");

  // Accumulate the last MAX_TRAIL positions per aircraft each time flights updates.
  // useEffect runs after commit, so trailsRef is always one tick ahead of the render
  // that reads it — the trail naturally lags slightly behind the icon (comet tail).
  useEffect(() => {
    for (const f of flights) {
      const prev = trailsRef.current[f.callsign] ?? [];
      const last = prev[prev.length - 1];
      if (!last || last[0] !== f.lon || last[1] !== f.lat) {
        trailsRef.current[f.callsign] = [
          ...prev, [f.lon, f.lat] as [number, number],
        ].slice(-MAX_TRAIL);
      }
    }
  }, [flights]);

  // ── Hover ────────────────────────────────────────────────────────────────
  const handleHover = useCallback((info: PickingInfo) => {
    if (!info.object || !info.layer) { onTooltip(null); return; }
    const { object, layer, x, y } = info;
    const lid = layer.id as string;
    let title = "";
    let rows: [string, string][] = [];

    if (lid.startsWith("fl-")) {
      const f = object as FlightTrack;
      title = f.callsign;
      rows = [
        ["TYPE",   f.type.toUpperCase()],
        ["ALT",    `${f.altitude.toLocaleString()} ft`],
        ["SPEED",  `${f.speed} kts`],
        ["HDG",    `${Math.round(f.heading)}°`],
        ["STATUS", f.diverted ? "DIVERTED" : "NORMAL"],
      ];
    } else if (lid.startsWith("sh-")) {
      const s = object as Ship;
      title = s.name;
      rows = [
        ["TYPE",  s.type.toUpperCase()],
        ["FLAG",  s.flag],
        ["SPEED", `${s.speed} kts`],
        ["HDG",   `${Math.round(s.heading)}°`],
        ["POS",   `${s.lat.toFixed(3)}N ${s.lon.toFixed(3)}E`],
      ];
    } else if (lid.startsWith("sat-")) {
      const sat = object as Satellite;
      title = sat.name;
      rows = [
        ["TYPE",     sat.type.toUpperCase()],
        ["ALT",      `${sat.altitude} km`],
        ["OVERPASS", sat.overpassActive ? "ACTIVE" : "INACTIVE"],
        ["POS",      `${sat.lat.toFixed(2)}N ${sat.lon.toFixed(2)}E`],
      ];
    } else if (lid === "gps-outer") {
      const z = object as GpsJamZone;
      title = "GPS JAMMING";
      rows = [
        ["ZONE",      z.id.toUpperCase()],
        ["RADIUS",    `${z.radiusKm} km`],
        ["INTENSITY", `${Math.round(z.intensity * 100)}%`],
      ];
    } else if (lid.startsWith("nfz-")) {
      const z = object as NoFlyZone;
      title = "NO-FLY ZONE";
      rows = [
        ["NAME",   z.name],
        ["STATUS", z.active ? "ACTIVE" : "INACTIVE"],
      ];
    } else if (lid.startsWith("ev-")) {
      const e = object as EventMarker;
      title = e.title;
      rows = [
        ["TYPE",     e.type.toUpperCase()],
        ["SEVERITY", e.severity.toUpperCase()],
        ["DESC",     e.description.slice(0, 65) + "…"],
      ];
    }

    if (title) onTooltip({ x, y, title, rows });
  }, [onTooltip]);

  // ── Click ─────────────────────────────────────────────────────────────────
  const handleClick = useCallback((info: PickingInfo) => {
    if (!info.object || !info.layer) return;
    const lid = info.layer.id as string;
    if (lid.startsWith("fl-"))  onEntityClick("flight",    (info.object as FlightTrack).callsign);
    if (lid.startsWith("sh-"))  onEntityClick("ship",      (info.object as Ship).name);
    if (lid.startsWith("sat-")) onEntityClick("satellite", (info.object as Satellite).name);
    if (lid.startsWith("ev-"))  onEntityClick("event",     (info.object as EventMarker).id);
  }, [onEntityClick]);

  // ── Deck.gl layers ────────────────────────────────────────────────────────
  // bg = drawn first (behind everything); fg = drawn last (on top of everything).
  // In deck.gl, later array position = rendered on top (painter's algorithm).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deckLayers = useMemo((): any[] => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bg: any[]  = []; // bottom: NFZ fill, GPS zones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mid: any[] = []; // middle: ships, satellites, events, NFZ labels
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const air: any[] = []; // top: aircraft icons + labels (always above everything)

    // ── GPS Jamming (background) ────────────────────────────────────────────
    if (vis.gpsJamming) {
      bg.push(
        new ScatterplotLayer({
          id: "gps-inner",
          data: gpsZones,
          getPosition: (d: GpsJamZone) => [d.center[1], d.center[0]] as [number, number],
          getRadius: (d: GpsJamZone) => d.radiusKm * 850,
          radiusUnits: "meters",
          stroked: false, filled: true,
          getFillColor: (d: GpsJamZone): RGBA => [255, 60, 0, Math.round(d.intensity * 55)],
          pickable: false,
        }),
        new ScatterplotLayer({
          id: "gps-outer",
          data: gpsZones,
          getPosition: (d: GpsJamZone) => [d.center[1], d.center[0]] as [number, number],
          getRadius: (d: GpsJamZone) => d.radiusKm * 1000,
          radiusUnits: "meters",
          stroked: true, filled: false,
          getLineColor: (d: GpsJamZone): RGBA => [255, 140, 0, Math.round(d.intensity * 180)],
          lineWidthMinPixels: 1.5,
          pickable: true,
        }),
      );
    }

    // ── No-Fly Zones fill + border (background) — labels go into fg below ───
    if (vis.noFlyZones) {
      bg.push(
        new PolygonLayer({
          id: "nfz-fill",
          data: noFlyZones,
          getPolygon: (d: NoFlyZone) => d.polygon as [number, number][],
          getFillColor: (d: NoFlyZone): RGBA => d.active ? [255, 51, 102, 30] : [255, 140, 0, 15],
          getLineColor: (d: NoFlyZone): RGBA => d.active ? [255, 51, 102, 160] : [255, 140, 0, 90],
          lineWidthMinPixels: 1,
          stroked: true, filled: true,
          pickable: true,
        }),
      );
    }

    // ── Ships ───────────────────────────────────────────────────────────────
    if (vis.ships) {
      const SHIP_ICONS: Record<string, IconDef> = {
        tanker: ICONS.tanker, cargo: ICONS.cargo,
        warship: ICONS.warship, carrier: ICONS.carrier,
      };
      const SHIP_COLORS: Record<string, RGBA> = {
        tanker: C.tanker, cargo: C.cargo, warship: C.warship, carrier: C.carrier,
      };
      mid.push(
        new IconLayer({
          id: "sh-icons",
          data: ships,
          getPosition: (d: Ship) => [d.lon, d.lat] as [number, number],
          getIcon: (d: Ship) => SHIP_ICONS[d.type] ?? ICONS.cargo,
          getSize: (d: Ship) => d.type === "carrier" ? 46 : d.type === "warship" ? 38 : 30,
          getColor: (d: Ship): RGBA => SHIP_COLORS[d.type] ?? C.cargo,
          getAngle: (d: Ship) => -d.heading,
          pickable: true,
          transitions: { getPosition: 2000 },
        }),
        new TextLayer({
          id: "sh-labels",
          data: ships,
          getPosition: (d: Ship) => [d.lon, d.lat] as [number, number],
          getText: (d: Ship) => d.name,
          getColor: [255, 215, 0, 175] as RGBA,
          getSize: 9,
          getPixelOffset: [0, 24],
          fontFamily: "monospace",
          background: true,
          getBackgroundColor: BG,
          backgroundPadding: BG_PAD,
          pickable: false,
        }),
      );
    }

    // ── Satellites ──────────────────────────────────────────────────────────
    if (vis.satellites) {
      const satColor = (d: Satellite): RGBA =>
        d.type === "spy" ? C.sat_spy : d.type === "comms" ? C.sat_comms : C.sat_com;

      mid.push(
        new ScatterplotLayer({
          id: "sat-rings",
          data: satellites.filter(s => s.overpassActive),
          getPosition: (d: Satellite) => [d.lon, d.lat] as [number, number],
          getRadius: 250000,
          radiusUnits: "meters",
          stroked: true, filled: false,
          getLineColor: [0, 255, 157, 160] as RGBA,
          lineWidthMinPixels: 1,
          pickable: false,
        }),
        new IconLayer({
          id: "sat-icons",
          data: satellites,
          getPosition: (d: Satellite) => [d.lon, d.lat] as [number, number],
          getIcon: () => ICONS.satellite,
          getSize: (d: Satellite) => d.overpassActive ? 40 : 26,
          getColor: satColor,
          getAngle: 0,
          pickable: true,
          transitions: { getPosition: 2000 },
        }),
        new TextLayer({
          id: "sat-labels",
          data: satellites.filter(s => s.overpassActive || s.type === "spy"),
          getPosition: (d: Satellite) => [d.lon, d.lat] as [number, number],
          getText: (d: Satellite) => d.name,
          getColor: (d: Satellite): RGBA => d.type === "spy" ? [255, 51, 102, 215] : [0, 255, 157, 185],
          getSize: 9,
          getPixelOffset: [0, -28],
          fontFamily: "monospace",
          background: true,
          getBackgroundColor: BG,
          backgroundPadding: BG_PAD,
          pickable: false,
        }),
      );
    }

    // ── Event Markers ────────────────────────────────────────────────────────
    if (vis.events) {
      const active = events.filter(e => e.active);
      const EVT_ICONS: Record<string, IconDef> = {
        strike: ICONS.strike, explosion: ICONS.explosion,
        closure: ICONS.closure, declaration: ICONS.declaration,
        diversion: ICONS.diversion,
      };
      mid.push(
        new ScatterplotLayer({
          id: "ev-rings",
          data: active,
          getPosition: (d: EventMarker) => [d.lon, d.lat] as [number, number],
          getRadius: (d: EventMarker) => d.severity === "critical" ? 100000 : 70000,
          radiusUnits: "meters",
          stroked: true, filled: false,
          getLineColor: (d: EventMarker): RGBA => evtC(d.severity),
          lineWidthMinPixels: 1.5,
          pickable: false,
        }),
        new IconLayer({
          id: "ev-icons",
          data: active,
          getPosition: (d: EventMarker) => [d.lon, d.lat] as [number, number],
          getIcon: (d: EventMarker) => EVT_ICONS[d.type] ?? ICONS.strike,
          getSize: (d: EventMarker) => d.severity === "critical" ? 42 : 34,
          getColor: (d: EventMarker): RGBA => evtC(d.severity),
          getAngle: 0,
          pickable: true,
        }),
        new TextLayer({
          id: "ev-labels",
          data: active,
          getPosition: (d: EventMarker) => [d.lon, d.lat] as [number, number],
          getText: (d: EventMarker) => d.title,
          getColor: (d: EventMarker): RGBA => evtC(d.severity),
          getSize: 10,
          getPixelOffset: [0, -36],
          fontFamily: "monospace",
          fontWeight: "bold",
          background: true,
          getBackgroundColor: [5, 10, 15, 210] as RGBA,
          backgroundPadding: [5, 2, 5, 2],
          pickable: false,
        }),
      );
    }

    // ── NFZ labels ───────────────────────────────────────────────────────────
    if (vis.noFlyZones) {
      mid.push(
        new TextLayer({
          id: "nfz-labels",
          data: noFlyZones,
          getPosition: (d: NoFlyZone) => {
            const lons = d.polygon.map(p => p[0]);
            const lats = d.polygon.map(p => p[1]);
            return [
              (Math.max(...lons) + Math.min(...lons)) / 2,
              (Math.max(...lats) + Math.min(...lats)) / 2,
            ] as [number, number];
          },
          getText: (d: NoFlyZone) => d.name,
          getColor: (d: NoFlyZone): RGBA => d.active ? [255, 51, 102, 220] : [255, 140, 0, 150],
          getSize: 10,
          fontFamily: "monospace",
          fontWeight: "bold",
          maxWidth: 200,
          wordBreak: "break-word",
          background: true,
          getBackgroundColor: BG,
          backgroundPadding: BG_PAD,
          pickable: true,
        }),
      );
    }

    // ── Commercial Flights (topmost) ────────────────────────────────────────
    if (vis.commercialFlights) {
      const cf = flights.filter(f => f.type === "commercial");
      air.push(
        new IconLayer({
          id: "fl-comm",
          data: cf,
          getPosition: (d: FlightTrack) => [d.lon, d.lat] as [number, number],
          getIcon: () => ICONS.commercial,
          getSize: 32,
          getColor: (d: FlightTrack): RGBA => d.diverted ? C.diverted : C.commercial,
          getAngle: (d: FlightTrack) => -d.heading,
          pickable: true,
          transitions: { getPosition: 1500 },
        }),
      );
    }

    // ── Military Flights (topmost) ──────────────────────────────────────────
    if (vis.militaryFlights) {
      const mf = flights.filter(f => f.type === "military");
      air.push(
        new IconLayer({
          id: "fl-mil",
          data: mf,
          getPosition: (d: FlightTrack) => [d.lon, d.lat] as [number, number],
          getIcon: () => ICONS.military,
          getSize: 36,
          getColor: (): RGBA => C.military,
          getAngle: (d: FlightTrack) => -d.heading,
          pickable: true,
          transitions: { getPosition: 1500 },
        }),
        new TextLayer({
          id: "fl-mil-labels",
          data: mf,
          getPosition: (d: FlightTrack) => [d.lon, d.lat] as [number, number],
          getText: (d: FlightTrack) => d.callsign,
          getColor: [255, 51, 102, 200] as RGBA,
          getSize: 9,
          getPixelOffset: [0, -28],
          fontFamily: "monospace",
          background: true,
          getBackgroundColor: BG,
          backgroundPadding: BG_PAD,
          pickable: false,
        }),
      );
    }

    // bg → mid → air: NFZ fills behind everything, aircraft icons in front of everything
    return [...bg, ...mid, ...air];
  }, [flights, ships, satellites, gpsZones, noFlyZones, events, vis]);

  // ── Camera helpers ────────────────────────────────────────────────────────
  const zoomIn     = useCallback(() => mapRef.current?.getMap()?.zoomIn({ duration: 300 }), []);
  const zoomOut    = useCallback(() => mapRef.current?.getMap()?.zoomOut({ duration: 300 }), []);
  const resetView  = useCallback(() => mapRef.current?.getMap()?.flyTo({ center: [44.65, 30.32], zoom: 5.5, pitch: 45, bearing: 0, duration: 1500 }), []);
  const resetNorth = useCallback(() => mapRef.current?.getMap()?.easeTo({ bearing: 0, duration: 800 }), []);
  const toggleTilt = useCallback(() => { const map = mapRef.current?.getMap(); if (map) map.easeTo({ pitch: map.getPitch() > 10 ? 0 : 45, duration: 600 }); }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 44.65, latitude: 30.32, zoom: 5.5, pitch: 45, bearing: 0 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLES[mapStyle]}
        onMouseLeave={() => onTooltip(null)}
        attributionControl={false}
      >
        <DeckGLOverlay layers={deckLayers} onHover={handleHover} onClick={handleClick} />
      </Map>

      {/* ── Map style switcher ─────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 4, zIndex: 10 }}>
        {STYLE_BTNS.map(({ key, label }) => {
          const active = mapStyle === key;
          return (
            <button
              key={key}
              onClick={() => setMapStyle(key)}
              style={{
                padding: "5px 9px",
                fontSize: "9px",
                fontFamily: "var(--font-display)",
                letterSpacing: "0.1em",
                background: active ? "rgba(0,212,255,0.18)" : "rgba(5,10,15,0.88)",
                border: `1px solid ${active ? "var(--accent-cyan)" : "var(--border)"}`,
                color: active ? "var(--accent-cyan)" : "var(--text-secondary)",
                borderRadius: "3px",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                transition: "all 0.2s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Camera controls ────────────────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 46, right: 12, display: "flex", flexDirection: "column", gap: 4, zIndex: 10 }}>
        <CamBtn label="+" title="Zoom in"     onClick={zoomIn}     />
        <CamBtn label="−" title="Zoom out"    onClick={zoomOut}    />
        <CamBtn label="⌖" title="Reset view"  onClick={resetView}  />
        <CamBtn label="N" title="Reset north" onClick={resetNorth} />
        <CamBtn label="3D" title="Toggle tilt" onClick={toggleTilt} small />
      </div>

      {/* ── CRT scan-line overlay ───────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute", inset: 0,
          pointerEvents: "none", zIndex: 1,
          background: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,255,0.012) 2px,rgba(0,212,255,0.012) 4px)",
        }}
      />
    </div>
  );
}
