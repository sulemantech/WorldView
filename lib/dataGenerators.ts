// ============================================================
// WORLDVIEW — Data Generation Engine
// All mock OSINT data: flights, ships, satellites, events
// ============================================================

export interface FlightTrack {
  id: string;
  callsign: string;
  type: "commercial" | "military";
  origin: [number, number];
  destination: [number, number];
  altitude: number;
  speed: number;
  heading: number;
  lat: number;
  lon: number;
  progress: number; // 0-1
  color: string;
  diverted?: boolean;
  divertTarget?: [number, number];
}

export interface Ship {
  id: string;
  name: string;
  type: "tanker" | "cargo" | "warship" | "carrier";
  lat: number;
  lon: number;
  heading: number;
  speed: number; // knots
  flag: string;
  color: string;
}

export interface Satellite {
  id: string;
  name: string;
  type: "commercial" | "spy" | "comms";
  lat: number;
  lon: number;
  altitude: number; // km
  inclination: number; // degrees
  period: number; // minutes
  t: number; // orbit phase 0-1
  color: string;
  overpassActive: boolean;
}

export interface GpsJamZone {
  id: string;
  center: [number, number];
  radiusKm: number;
  intensity: number; // 0-1
}

export interface NoFlyZone {
  id: string;
  name: string;
  polygon: [number, number][]; // [lon, lat] pairs
  active: boolean;
}

export interface EventMarker {
  id: string;
  type: "strike" | "explosion" | "closure" | "declaration" | "diversion";
  title: string;
  description: string;
  lat: number;
  lon: number;
  timestamp: number; // minutes from T0
  active: boolean;
  severity: "critical" | "high" | "medium" | "low";
}

// ─── Commercial Flight Routes (realistic Middle East / Asia corridors) ──────
export const COMMERCIAL_FLIGHT_DEFS: Omit<FlightTrack, "lat" | "lon" | "heading" | "progress">[] = [
  { id: "f01", callsign: "EK202", type: "commercial", origin: [25.2528, 55.3644], destination: [51.5074, -0.1278], altitude: 39000, speed: 910, color: "#4488ff" },
  { id: "f02", callsign: "QR006", type: "commercial", origin: [25.2731, 51.6086], destination: [40.6413, -73.7781], altitude: 37000, speed: 920, color: "#4488ff" },
  { id: "f03", callsign: "TK018", type: "commercial", origin: [41.2753, 28.7519], destination: [1.3644, 103.9915], altitude: 38000, speed: 890, color: "#4488ff" },
  { id: "f04", callsign: "LH692", type: "commercial", origin: [50.0333, 8.5706], destination: [19.0760, 72.8777], altitude: 37000, speed: 900, color: "#4488ff" },
  { id: "f05", callsign: "AF448", type: "commercial", origin: [49.0097, 2.5479], destination: [28.5562, 77.1000], altitude: 39000, speed: 870, color: "#4488ff" },
  { id: "f06", callsign: "BA103", type: "commercial", origin: [51.4775, -0.4614], destination: [24.9876, 55.4209], altitude: 38500, speed: 895, color: "#4488ff" },
  { id: "f07", callsign: "EK512", type: "commercial", origin: [25.2528, 55.3644], destination: [35.5494, 139.7798], altitude: 40000, speed: 930, color: "#4488ff" },
  { id: "f08", callsign: "SV872", type: "commercial", origin: [24.9578, 46.6989], destination: [51.5074, -0.1278], altitude: 36000, speed: 860, color: "#4488ff" },
  { id: "f09", callsign: "MS804", type: "commercial", origin: [30.1219, 31.4056], destination: [48.8566, 2.3522], altitude: 37500, speed: 875, color: "#4488ff" },
  { id: "f10", callsign: "IR724", type: "commercial", origin: [35.6892, 51.3890], destination: [55.7558, 37.6173], altitude: 35000, speed: 840, color: "#4488ff" },
  { id: "f11", callsign: "FZ917", type: "commercial", origin: [25.2528, 55.3644], destination: [35.6892, 51.3890], altitude: 34000, speed: 820, color: "#4488ff" },
  { id: "f12", callsign: "GF006", type: "commercial", origin: [26.2700, 50.6332], destination: [51.5074, -0.1278], altitude: 38000, speed: 880, color: "#4488ff" },
  { id: "f13", callsign: "OA342", type: "commercial", origin: [37.9364, 23.9445], destination: [25.2528, 55.3644], altitude: 36500, speed: 855, color: "#4488ff" },
  { id: "f14", callsign: "LX174", type: "commercial", origin: [47.4582, 8.5555], destination: [22.3080, 113.9185], altitude: 39500, speed: 915, color: "#4488ff" },
  { id: "f15", callsign: "KU109", type: "commercial", origin: [29.2268, 47.9690], destination: [51.5074, -0.1278], altitude: 37000, speed: 870, color: "#4488ff" },
  // Divertable flights (near Iran corridor)
  { id: "f16", callsign: "EK416", type: "commercial", origin: [51.5074, -0.1278], destination: [25.2528, 55.3644], altitude: 38000, speed: 900, color: "#4488ff" },
  { id: "f17", callsign: "QR702", type: "commercial", origin: [48.8566, 2.3522], destination: [25.2731, 51.6086], altitude: 37500, speed: 885, color: "#4488ff" },
  { id: "f18", callsign: "TK794", type: "commercial", origin: [41.2753, 28.7519], destination: [25.2528, 55.3644], altitude: 36000, speed: 860, color: "#4488ff" },
  { id: "f19", callsign: "AF748", type: "commercial", origin: [49.0097, 2.5479], destination: [25.2731, 51.6086], altitude: 38500, speed: 895, color: "#4488ff" },
  { id: "f20", callsign: "LH1296", type: "commercial", origin: [50.0333, 8.5706], destination: [22.3080, 113.9185], altitude: 39000, speed: 920, color: "#4488ff" },
];

// ─── Military Flight Definitions ────────────────────────────────────────────
export const MILITARY_FLIGHT_DEFS: Omit<FlightTrack, "lat" | "lon" | "heading" | "progress">[] = [
  { id: "m01", callsign: "REACH45", type: "military", origin: [36.0832, 14.4372], destination: [25.2731, 51.6086], altitude: 28000, speed: 780, color: "#ff3366" },
  { id: "m02", callsign: "VIPER01", type: "military", origin: [37.4319, 15.0662], destination: [30.0594, 31.2272], altitude: 18000, speed: 1100, color: "#ff3366" },
  { id: "m03", callsign: "BONE22", type: "military", origin: [28.2195, -16.9151], destination: [25.2731, 51.6086], altitude: 40000, speed: 900, color: "#ff3366" },
  { id: "m04", callsign: "AWACS90", type: "military", origin: [35.8617, 14.5133], destination: [35.8617, 14.5133], altitude: 30000, speed: 450, color: "#ff8c00" }, // racetrack
  { id: "m05", callsign: "KCIL32", type: "military", origin: [24.4539, 54.3773], destination: [25.2731, 51.6086], altitude: 22000, speed: 580, color: "#ff3366" },
  { id: "m06", callsign: "GHOST11", type: "military", origin: [25.2731, 51.6086], destination: [27.9654, 86.8214], altitude: 15000, speed: 1400, color: "#ff3366" },
  { id: "m07", callsign: "SPECTRE9", type: "military", origin: [12.3456, 43.7234], destination: [25.2731, 51.6086], altitude: 25000, speed: 720, color: "#ff3366" },
];

// ─── Ship Definitions ────────────────────────────────────────────────────────
export const SHIP_DEFS: Omit<Ship, "lat" | "lon" | "heading">[] = [
  { id: "s01", name: "NS ENDEAVOUR", type: "tanker", speed: 14, flag: "🇸🇦", color: "#ffd700" },
  { id: "s02", name: "GULF PRINCESS", type: "tanker", speed: 12, flag: "🇰🇼", color: "#ffd700" },
  { id: "s03", name: "HORMUZ STAR", type: "tanker", speed: 11, flag: "🇦🇪", color: "#ffd700" },
  { id: "s04", name: "PACIFIC TRADER", type: "cargo", speed: 16, flag: "🇸🇬", color: "#ffaa00" },
  { id: "s05", name: "MSC AURORA", type: "cargo", speed: 18, flag: "🇨🇭", color: "#ffaa00" },
  { id: "s06", name: "USS THEODORE R.", type: "carrier", speed: 28, flag: "🇺🇸", color: "#ff6644" },
  { id: "s07", name: "USS COLE", type: "warship", speed: 30, flag: "🇺🇸", color: "#ff6644" },
  { id: "s08", name: "IRAN KHARG", type: "warship", speed: 25, flag: "🇮🇷", color: "#ff3366" },
  { id: "s09", name: "ARABIAN GLORY", type: "tanker", speed: 13, flag: "🇮🇶", color: "#ffd700" },
  { id: "s10", name: "SUEZ PROVIDER", type: "cargo", speed: 17, flag: "🇪🇬", color: "#ffaa00" },
  { id: "s11", name: "INS VIKRANT", type: "carrier", speed: 24, flag: "🇮🇳", color: "#44aaff" },
  { id: "s12", name: "HMS QUEEN E.", type: "carrier", speed: 25, flag: "🇬🇧", color: "#44aaff" },
  { id: "s13", name: "ALBATROSS K", type: "tanker", speed: 10, flag: "🇬🇷", color: "#ffd700" },
];

// Ship initial positions — all verified to be open water
// [lat, lon]: Persian Gulf, Gulf of Oman, Arabian Sea, Red Sea
export const SHIP_INITIAL_POSITIONS: [number, number][] = [
  [27.5, 56.5], [26.0, 54.0], [24.5, 59.0], [22.0, 63.0], [20.0, 65.0],
  [24.0, 58.0], [23.0, 57.0], [26.5, 56.5], [27.5, 50.5], [27.0, 34.0],
  [15.0, 72.0], [22.5, 60.5], [20.0, 38.0],
];

export const SHIP_HEADINGS = [45, 270, 135, 90, 315, 200, 160, 350, 70, 180, 240, 120, 30];

// ─── Satellite Definitions ────────────────────────────────────────────────────
export const SATELLITE_DEFS: Omit<Satellite, "lat" | "lon" | "t" | "overpassActive">[] = [
  {
    id: "sat01", name: "SENTINEL-2A", type: "commercial",
    altitude: 786, inclination: 98.6, period: 100.6,
    color: "#00ff9d"
  },
  {
    id: "sat02", name: "WORLDVIEW-3", type: "commercial",
    altitude: 617, inclination: 97.9, period: 97.0,
    color: "#00ff9d"
  },
  {
    id: "sat03", name: "USA-224 [KH-11]", type: "spy",
    altitude: 340, inclination: 97.4, period: 91.2,
    color: "#ff3366"
  },
  {
    id: "sat04", name: "MUOS-3", type: "comms",
    altitude: 35786, inclination: 0, period: 1436,
    color: "#9b59ff"
  },
  {
    id: "sat05", name: "NAVSTAR GPS-70", type: "comms",
    altitude: 20200, inclination: 55, period: 718,
    color: "#9b59ff"
  },
];

// ─── GPS Jamming Initial Zones ───────────────────────────────────────────────
export const GPS_JAM_ZONES_INITIAL: GpsJamZone[] = [
  { id: "j01", center: [36.0, 36.2], radiusKm: 150, intensity: 0.7 }, // Syria/Turkey border
  { id: "j02", center: [32.5, 35.5], radiusKm: 80, intensity: 0.5 },  // Lebanon/Israel
  { id: "j03", center: [55.75, 37.6], radiusKm: 200, intensity: 0.3 }, // Moscow
];

// ─── No-Fly Zone Definitions ─────────────────────────────────────────────────
export const NO_FLY_ZONES: NoFlyZone[] = [
  {
    id: "nfz01",
    name: "IRAN ADIZ - RESTRICTED",
    active: false, // activated at T+15
    polygon: [
      [44, 25], [63, 25], [63, 40], [44, 40], [44, 25]
    ]
  },
  {
    id: "nfz02",
    name: "UKRAINE CONFLICT ZONE",
    active: true,
    polygon: [
      [31, 48], [40, 48], [40, 52], [31, 52], [31, 48]
    ]
  },
  {
    id: "nfz03",
    name: "LIBYAN AIRSPACE",
    active: true,
    polygon: [
      [9.5, 19.5], [25, 19.5], [25, 33], [9.5, 33], [9.5, 19.5]
    ]
  },
];

// ─── Playback Events Timeline ─────────────────────────────────────────────────
export const PLAYBACK_EVENTS: EventMarker[] = [
  {
    id: "ev01",
    type: "strike",
    title: "STRIKE: NATANZ FACILITY",
    description: "Precision strike on uranium enrichment facility. Multiple warhead impacts detected. IAEA monitoring offline.",
    lat: 34.0,
    lon: 51.5,
    timestamp: 0,
    active: false,
    severity: "critical",
  },
  {
    id: "ev02",
    type: "declaration",
    title: "IRAN NFZ DECLARED",
    description: "Iranian CAA issues NOTAM closing airspace. All commercial traffic ordered to reroute. Air defense systems on high alert.",
    lat: 32.5,
    lon: 53.5,
    timestamp: 15,
    active: false,
    severity: "high",
  },
  {
    id: "ev03",
    type: "diversion",
    title: "FLIGHT DIVERSIONS BEGIN",
    description: "5 commercial flights rerouting via Arabian Sea corridor. EK416, QR702, TK794, AF748, LH1296 affected.",
    lat: 30.0,
    lon: 58.0,
    timestamp: 30,
    active: false,
    severity: "medium",
  },
  {
    id: "ev04",
    type: "explosion",
    title: "GPS JAMMING INTENSIFIED",
    description: "Broadband GPS/GNSS jamming expanding across Persian Gulf. Shipping navigation severely degraded. AIS signals lost.",
    lat: 27.0,
    lon: 54.0,
    timestamp: 45,
    active: false,
    severity: "high",
  },
  {
    id: "ev05",
    type: "strike",
    title: "RETALIATION: AL UDEID AB",
    description: "Ballistic missile impact on US Air Base, Qatar. Damage assessment ongoing. Force protection FPCON Delta.",
    lat: 25.2,
    lon: 51.6,
    timestamp: 60,
    active: false,
    severity: "critical",
  },
  {
    id: "ev06",
    type: "closure",
    title: "STRAIT OF HORMUZ CLOSED",
    description: "Iran IRIN announces closure. 21M barrels/day oil transit halted. 6th Fleet on intercept orders.",
    lat: 26.5,
    lon: 56.0,
    timestamp: 90,
    active: false,
    severity: "critical",
  },
];

// ─── AI Agent Messages ────────────────────────────────────────────────────────
export const AI_AGENT_MESSAGES = [
  { delay: 0, msg: "Initializing WORLDVIEW sensor fusion engine...", type: "system" },
  { delay: 2000, msg: "Ingesting ADS-B feed: 1,247 active tracks", type: "ai" },
  { delay: 4500, msg: "Cross-referencing ICAO hex codes with military registry...", type: "ai" },
  { delay: 7000, msg: "Satellite imagery: SENTINEL-2A tasked over region", type: "satellite" },
  { delay: 9000, msg: "AIS signal: 3 vessels dark in Persian Gulf", type: "ship" },
  { delay: 12000, msg: "Anomaly: Military callsign REACH45 entering AOI", type: "flight" },
  { delay: 15000, msg: "SIGINT: Encrypted traffic spike on 8.1GHz band", type: "ai" },
  { delay: 18000, msg: "Pattern-of-life deviation: IR724 altitude drop", type: "ai" },
  { delay: 21000, msg: "Correlating satellite pass with ground activity...", type: "satellite" },
  { delay: 24000, msg: "GPS integrity alert: Spoofing detected N32.5/E35.5", type: "gps" },
  { delay: 27000, msg: "Open-source: Social media blackout in Isfahan province", type: "ai" },
  { delay: 30000, msg: "ADS-B: 5 aircraft squawking 7700 (Emergency)", type: "flight" },
  { delay: 33000, msg: "Maritime: Carrier group USS THEODORE R. heading 185°", type: "ship" },
  { delay: 36000, msg: "OSINT: Fuel depot trucks mobilizing — Bandar Abbas", type: "ai" },
  { delay: 39000, msg: "Anomaly: AWACS90 orbit change — expanding coverage", type: "flight" },
  { delay: 42000, msg: "Signal loss: 2 ground stations offline in eastern Iran", type: "gps" },
  { delay: 45000, msg: "Threat assessment: CRITICAL — escalation ladder active", type: "ai" },
  { delay: 48000, msg: "Re-tasking KH-11 for next overpass window: T+4min", type: "satellite" },
  { delay: 51000, msg: "HUMINT corroboration: Asset ZEPHYR reports convoy movement", type: "ai" },
  { delay: 54000, msg: "Electronic order of battle updated — 14 new emitters", type: "ai" },
];

// ─── Utility: Interpolate along great circle ──────────────────────────────────
export function interpolatePath(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  // Simple linear interpolation (good enough for short distances)
  const lat = from[0] + (to[0] - from[0]) * t;
  const lon = from[1] + (to[1] - from[1]) * t;
  return [lat, lon];
}

export function bearing(from: [number, number], to: [number, number]): number {
  const φ1 = (from[0] * Math.PI) / 180;
  const φ2 = (to[0] * Math.PI) / 180;
  const Δλ = ((to[1] - from[1]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ─── Satellite orbital position calculation ───────────────────────────────────
export function satPosition(
  sat: Pick<Satellite, "inclination" | "period" | "altitude">,
  t: number // orbit phase 0-1
): [number, number] {
  // Simplified circular orbit
  const omega = t * 2 * Math.PI;
  const inc = (sat.inclination * Math.PI) / 180;
  // Ground track approximation
  const lat = (Math.asin(Math.sin(inc) * Math.sin(omega)) * 180) / Math.PI;
  const lon = (Math.atan2(Math.cos(inc) * Math.sin(omega), Math.cos(omega)) * 180) / Math.PI;
  return [lat, lon];
}

// Initialize flight positions
export function initializeFlights(): FlightTrack[] {
  return [...COMMERCIAL_FLIGHT_DEFS, ...MILITARY_FLIGHT_DEFS].map((def) => {
    const progress = Math.random() * 0.6 + 0.1;
    const [lat, lon] = interpolatePath(def.origin, def.destination, progress);
    const hdg = bearing(def.origin, def.destination);
    return { ...def, lat, lon, heading: hdg, progress };
  });
}

// Initialize ships
export function initializeShips(): Ship[] {
  return SHIP_DEFS.map((def, i) => ({
    ...def,
    lat: SHIP_INITIAL_POSITIONS[i][0],
    lon: SHIP_INITIAL_POSITIONS[i][1],
    heading: SHIP_HEADINGS[i],
  }));
}

// Initialize satellites
export function initializeSatellites(): Satellite[] {
  return SATELLITE_DEFS.map((def, i) => {
    const t = (i / SATELLITE_DEFS.length);
    const [lat, lon] = satPosition(def, t);
    return { ...def, lat, lon, t, overpassActive: false };
  });
}
