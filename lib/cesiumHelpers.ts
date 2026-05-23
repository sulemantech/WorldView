// ============================================================
// WORLDVIEW — Cesium Helper Functions
// Entity creation, styling, and management for Cesium.js
// ============================================================

// These functions run client-side with Cesium loaded via CDN

export function buildBillboardSVG(
  type: string,
  color: string,
  size = 24
): string {
  const shapes: Record<string, string> = {
    commercial: `<polygon points="0,-10 7,5 0,2 -7,5" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    military: `<polygon points="0,-12 8,6 0,3 -8,6" fill="${color}" stroke="#fff" stroke-width="0.5"/><circle cx="0" cy="-12" r="2" fill="${color}"/>`,
    tanker: `<rect x="-8" y="-4" width="16" height="8" rx="2" fill="${color}" stroke="#fff" stroke-width="0.5"/><rect x="-4" y="-8" width="8" height="4" fill="${color}"/>`,
    cargo: `<rect x="-6" y="-5" width="12" height="10" rx="1" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    warship: `<polygon points="0,-10 6,0 10,5 0,3 -10,5 -6,0" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    carrier: `<rect x="-10" y="-3" width="20" height="6" rx="1" fill="${color}" stroke="#fff" stroke-width="0.5"/><polygon points="-3,-3 3,-3 1,-8 -1,-8" fill="${color}"/>`,
    satellite: `<rect x="-10" y="-2" width="8" height="4" fill="${color}"/><rect x="2" y="-2" width="8" height="4" fill="${color}"/><circle cx="0" cy="0" r="3" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    strike: `<circle cx="0" cy="0" r="8" fill="none" stroke="${color}" stroke-width="2"/><line x1="-8" y1="0" x2="8" y2="0" stroke="${color}" stroke-width="2"/><line x1="0" y1="-8" x2="0" y2="8" stroke="${color}" stroke-width="2"/>`,
    explosion: `<polygon points="0,-12 3,-5 10,-8 6,-2 12,2 5,2 7,10 0,5 -7,10 -5,2 -12,2 -6,-2 -10,-8 -3,-5" fill="${color}" opacity="0.9"/>`,
    closure: `<polygon points="0,-10 8,5 -8,5" fill="${color}" stroke="#fff" stroke-width="0.5"/><rect x="-2" y="-4" width="4" height="6" fill="${color === '#ff3366' ? '#fff' : '#000'}"/>`,
    declaration: `<rect x="-8" y="-8" width="16" height="16" rx="2" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    diversion: `<path d="M-8,-8 L8,0 L-8,8 L-4,0 Z" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    default: `<circle cx="0" cy="0" r="6" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
  };

  const shape = shapes[type] || shapes.default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-12 -12 24 24">${shape}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function getEntityColor(type: string): string {
  const colors: Record<string, string> = {
    commercial: "#4488ff",
    military: "#ff3366",
    spy: "#ff3366",
    tanker: "#ffd700",
    cargo: "#ffaa00",
    warship: "#ff6644",
    carrier: "#ff6644",
    satellite: "#00ff9d",
    comms: "#9b59ff",
    strike: "#ff3366",
    explosion: "#ff8c00",
    closure: "#ff3366",
    declaration: "#ff8c00",
    diversion: "#4488ff",
  };
  return colors[type] || "#ffffff";
}

export type AppMode = "live" | "playback";

export interface LayerVisibility {
  commercialFlights: boolean;
  militaryFlights: boolean;
  satellites: boolean;
  ships: boolean;
  gpsJamming: boolean;
  noFlyZones: boolean;
  events: boolean;
  countryBoundaries: boolean;
  countryLabels: boolean;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  commercialFlights: true,
  militaryFlights: true,
  satellites: true,
  ships: true,
  gpsJamming: true,
  noFlyZones: true,
  events: true,
  countryBoundaries: true,
  countryLabels: true,
};
