"use client";
// ============================================================
// WORLDVIEW — CesiumGlobe Component
// 3D globe with all entity layers, interactions, and animation
// ============================================================

import { useEffect, useRef, useCallback } from "react";
import type {
  FlightTrack, Ship, Satellite, GpsJamZone, NoFlyZone, EventMarker
} from "@/lib/dataGenerators";
import type { LayerVisibility } from "@/lib/cesiumHelpers";

interface TooltipData {
  x: number;
  y: number;
  title: string;
  rows: [string, string][];
}

interface CesiumGlobeProps {
  flights: FlightTrack[];
  ships: Ship[];
  satellites: Satellite[];
  gpsZones: GpsJamZone[];
  noFlyZones: NoFlyZone[];
  events: EventMarker[];
  layers: LayerVisibility;
  onTooltip: (data: TooltipData | null) => void;
  onEntityClick?: (type: string, id: string) => void;
}

// We'll use window.Cesium loaded via CDN script tag
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Cesium: any;
    CESIUM_BASE_URL: string;
  }
}

export default function CesiumGlobe({
  flights, ships, satellites, gpsZones, noFlyZones, events, layers, onTooltip, onEntityClick
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const entitiesRef = useRef<Map<string, any>>(new Map());
  const jamLayerRef = useRef<any[]>([]);
  const nfzLayerRef = useRef<Map<string, any>>(new Map());
  const evtLayerRef = useRef<Map<string, any>>(new Map());
  const initRef = useRef(false);

  // Initialize Cesium viewer
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    if (typeof window === "undefined" || !window.Cesium) return;
    initRef.current = true;

    const Cesium = window.Cesium;
    Cesium.Ion.defaultAccessToken = undefined;

    const viewer = new Cesium.Viewer(containerRef.current, {
      imageryProvider: new Cesium.TileMapServiceImageryProvider({
        url: Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
      }),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shadows: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      skyBox: false,
      skyAtmosphere: true,
      backgroundColor: Cesium.Color.fromCssColorString("#050a0f"),
    });

    // Style atmosphere
    viewer.scene.skyAtmosphere.show = true;
    viewer.scene.globe.showGroundAtmosphere = true;
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString("#0a1a2a");
    viewer.scene.globe.enableLighting = false;

    // Set initial camera
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(52.0, 28.0, 8500000),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_FOUR * 0.7, roll: 0 }
    });

    // Add subtle grid-like dark ocean style
    viewer.scene.globe.imageryLayers.addImageryProvider(
      new Cesium.SingleTileImageryProvider({
        url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      })
    );

    viewerRef.current = viewer;

    // Click handler for tooltips
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((movement: any) => {
      const picked = viewer.scene.pick(movement.position);
      if (picked && picked.id) {
        const entity = picked.id;
        const meta = entity._meta;
        if (meta) {
          const rect = containerRef.current!.getBoundingClientRect();
          onTooltip({
            x: movement.position.x + rect.left,
            y: movement.position.y + rect.top,
            title: meta.title,
            rows: meta.rows,
          });
          onEntityClick?.(meta.type, meta.id);
        }
      } else {
        onTooltip(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      onTooltip(null);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      handler.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: ensure Cesium is ready
  const getViewer = () => viewerRef.current;

  // ─── Update Flights ───────────────────────────────────────────────────────
  const updateFlights = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;
    const show = layers.commercialFlights || layers.militaryFlights;
    if (!show) {
      // Hide all
      entitiesRef.current.forEach((e, key) => {
        if (key.startsWith("f") || key.startsWith("m")) e.show = false;
      });
      return;
    }

    flights.forEach((flight) => {
      const showThis =
        (flight.type === "commercial" && layers.commercialFlights) ||
        (flight.type === "military" && layers.militaryFlights);

      const existing = entitiesRef.current.get(flight.id);
      const pos = Cesium.Cartesian3.fromDegrees(flight.lon, flight.lat, flight.altitude * 0.3048);

      const color = flight.diverted
        ? Cesium.Color.fromCssColorString("#ff8c00")
        : Cesium.Color.fromCssColorString(flight.color);

      if (!existing) {
        const entity = viewer.entities.add({
          id: flight.id,
          position: pos,
          billboard: {
            image: getAircraftIcon(flight.type, flight.heading, flight.color, flight.diverted),
            width: flight.type === "military" ? 26 : 22,
            height: flight.type === "military" ? 26 : 22,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            show: showThis,
          },
          label: {
            text: flight.callsign,
            font: "10px Space Mono, monospace",
            fillColor: color,
            outlineColor: Cesium.Color.fromCssColorString("#050a0f"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            show: showThis,
          },
        });
        entity._meta = {
          type: flight.type,
          id: flight.id,
          title: `✈ ${flight.callsign}`,
          rows: [
            ["Type", flight.type === "military" ? "🔴 Military" : "🔵 Commercial"],
            ["Altitude", `${flight.altitude.toLocaleString()} ft`],
            ["Speed", `${flight.speed} kts`],
            ["Heading", `${Math.round(flight.heading)}°`],
            ["Position", `${flight.lat.toFixed(2)}°N ${flight.lon.toFixed(2)}°E`],
            ...(flight.diverted ? [["Status", "⚠ DIVERTED"] as [string, string]] : []),
          ],
        };
        entitiesRef.current.set(flight.id, entity);
      } else {
        existing.position = pos;
        existing.show = showThis;
        existing.billboard.show = showThis;
        existing.label.show = showThis;
        existing.billboard.image = getAircraftIcon(flight.type, flight.heading, flight.color, flight.diverted);
        if (flight.diverted) {
          existing.label.fillColor = Cesium.Color.fromCssColorString("#ff8c00");
        }
        existing._meta.rows = [
          ["Type", flight.type === "military" ? "🔴 Military" : "🔵 Commercial"],
          ["Altitude", `${flight.altitude.toLocaleString()} ft`],
          ["Speed", `${flight.speed} kts`],
          ["Heading", `${Math.round(flight.heading)}°`],
          ["Position", `${flight.lat.toFixed(2)}°N ${flight.lon.toFixed(2)}°E`],
          ...(flight.diverted ? [["Status", "⚠ DIVERTED"] as [string, string]] : []),
        ];
      }
    });
  }, [flights, layers]);

  // ─── Update Ships ─────────────────────────────────────────────────────────
  const updateShips = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    ships.forEach((ship) => {
      const existing = entitiesRef.current.get(ship.id);
      const pos = Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 0);
      const color = Cesium.Color.fromCssColorString(ship.color);

      if (!existing) {
        const entity = viewer.entities.add({
          id: ship.id,
          position: pos,
          billboard: {
            image: getShipIcon(ship.type, ship.color),
            width: 22, height: 22,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            show: layers.ships,
          },
          label: {
            text: ship.name,
            font: "9px Space Mono, monospace",
            fillColor: color,
            outlineColor: Cesium.Color.fromCssColorString("#050a0f"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            show: layers.ships,
          },
        });
        entity._meta = {
          type: ship.type,
          id: ship.id,
          title: `⛵ ${ship.name}`,
          rows: [
            ["Type", ship.type.toUpperCase()],
            ["Flag", ship.flag],
            ["Speed", `${ship.speed} knots`],
            ["Heading", `${ship.heading}°`],
            ["Position", `${ship.lat.toFixed(2)}°N ${ship.lon.toFixed(2)}°E`],
          ],
        };
        entitiesRef.current.set(ship.id, entity);
      } else {
        existing.position = pos;
        existing.show = layers.ships;
        existing.billboard.show = layers.ships;
        existing.label.show = layers.ships;
        existing._meta.rows[4] = ["Position", `${ship.lat.toFixed(2)}°N ${ship.lon.toFixed(2)}°E`];
      }
    });
  }, [ships, layers.ships]);

  // ─── Update Satellites ────────────────────────────────────────────────────
  const updateSatellites = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    satellites.forEach((sat) => {
      const existing = entitiesRef.current.get(sat.id);
      const pos = Cesium.Cartesian3.fromDegrees(sat.lon, sat.lat, sat.altitude * 1000);
      const color = Cesium.Color.fromCssColorString(sat.color);

      if (!existing) {
        const entity = viewer.entities.add({
          id: sat.id,
          position: pos,
          billboard: {
            image: getSatIcon(sat.type, sat.color),
            width: 26, height: 26,
            show: layers.satellites,
          },
          label: {
            text: sat.name,
            font: "9px Space Mono, monospace",
            fillColor: color,
            outlineColor: Cesium.Color.fromCssColorString("#050a0f"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            show: layers.satellites,
          },
          // Orbit path line
          polyline: {
            show: false, // We'll draw ground track separately
          },
        });
        entity._meta = {
          type: sat.type,
          id: sat.id,
          title: `🛰 ${sat.name}`,
          rows: [
            ["Class", sat.type.toUpperCase()],
            ["Altitude", `${sat.altitude} km`],
            ["Inclination", `${sat.inclination}°`],
            ["Period", `${sat.period} min`],
            ["Position", `${sat.lat.toFixed(1)}°N ${sat.lon.toFixed(1)}°E`],
            ["Overpass", sat.overpassActive ? "🔴 ACTIVE" : "—"],
          ],
        };
        entitiesRef.current.set(sat.id, entity);
      } else {
        existing.position = pos;
        existing.show = layers.satellites;
        existing.billboard.show = layers.satellites;
        existing.label.show = layers.satellites;
        existing._meta.rows[4] = ["Position", `${sat.lat.toFixed(1)}°N ${sat.lon.toFixed(1)}°E`];
        existing._meta.rows[5] = ["Overpass", sat.overpassActive ? "🔴 ACTIVE" : "—"];
      }
    });
  }, [satellites, layers.satellites]);

  // ─── Update GPS Jamming ───────────────────────────────────────────────────
  const updateGpsZones = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    // Remove old jam entities
    jamLayerRef.current.forEach((e) => viewer.entities.remove(e));
    jamLayerRef.current = [];

    if (!layers.gpsJamming) return;

    gpsZones.forEach((zone) => {
      const entity = viewer.entities.add({
        id: `jam_${zone.id}_${Date.now()}`,
        position: Cesium.Cartesian3.fromDegrees(zone.center[1], zone.center[0], 10000),
        ellipse: {
          semiMajorAxis: zone.radiusKm * 1000,
          semiMinorAxis: zone.radiusKm * 1000,
          material: Cesium.Color.fromCssColorString("#ff3366").withAlpha(
            0.08 + zone.intensity * 0.15
          ),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#ff3366").withAlpha(
            0.3 + zone.intensity * 0.4
          ),
          outlineWidth: 1,
          height: 0,
        },
      });
      jamLayerRef.current.push(entity);

      // Inner bright ring
      const inner = viewer.entities.add({
        id: `jam_inner_${zone.id}_${Date.now()}`,
        position: Cesium.Cartesian3.fromDegrees(zone.center[1], zone.center[0], 10000),
        ellipse: {
          semiMajorAxis: zone.radiusKm * 300,
          semiMinorAxis: zone.radiusKm * 300,
          material: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.25 + zone.intensity * 0.3),
          height: 0,
        },
      });
      jamLayerRef.current.push(inner);
    });
  }, [gpsZones, layers.gpsJamming]);

  // ─── Update No-Fly Zones ──────────────────────────────────────────────────
  const updateNoFlyZones = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    noFlyZones.forEach((nfz) => {
      const existing = nfzLayerRef.current.get(nfz.id);
      const show = layers.noFlyZones && nfz.active;

      // Polygon coordinates: [lon, lat] pairs → Cesium wants alternating lon,lat
      const positions = nfz.polygon.flatMap(([lon, lat]) => [lon, lat]);

      if (!existing) {
        const entity = viewer.entities.add({
          id: `nfz_${nfz.id}`,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
            material: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.08),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.6),
            outlineWidth: 2,
            show,
          },
          label: {
            text: nfz.name,
            font: "bold 11px Orbitron, monospace",
            fillColor: Cesium.Color.fromCssColorString("#ff3366"),
            outlineColor: Cesium.Color.fromCssColorString("#050a0f"),
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            show,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        nfzLayerRef.current.set(nfz.id, entity);
      } else {
        existing.polygon.show = show;
        existing.label.show = show;
      }
    });
  }, [noFlyZones, layers.noFlyZones]);

  // ─── Update Event Markers ─────────────────────────────────────────────────
  const updateEvents = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    events.forEach((evt) => {
      const existing = evtLayerRef.current.get(evt.id);
      const show = layers.events && evt.active;

      const color = evt.severity === "critical" ? "#ff3366" :
        evt.severity === "high" ? "#ff8c00" : "#ffd700";

      if (!existing) {
        const entity = viewer.entities.add({
          id: `evt_${evt.id}`,
          position: Cesium.Cartesian3.fromDegrees(evt.lon, evt.lat, 0),
          billboard: {
            image: getEventIcon(evt.type, color),
            width: 32, height: 32,
            show,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          },
          label: {
            text: evt.title,
            font: "bold 10px Orbitron, monospace",
            fillColor: Cesium.Color.fromCssColorString(color),
            outlineColor: Cesium.Color.fromCssColorString("#050a0f"),
            outlineWidth: 4,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -38),
            show,
          },
          // Pulsing ring for critical events
          ellipse: evt.severity === "critical" ? {
            semiMajorAxis: 80000,
            semiMinorAxis: 80000,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.15),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.5),
            outlineWidth: 1,
            show,
          } : undefined,
        });
        entity._meta = {
          type: evt.type,
          id: evt.id,
          title: evt.title,
          rows: [
            ["Severity", evt.severity.toUpperCase()],
            ["Time", `T+${evt.timestamp}min`],
            ["Position", `${evt.lat}°N ${evt.lon}°E`],
            ["Details", evt.description.substring(0, 60) + "..."],
          ],
        };
        evtLayerRef.current.set(evt.id, entity);
      } else {
        existing.show = show;
        existing.billboard.show = show;
        existing.label.show = show;
        if (existing.ellipse) existing.ellipse.show = show;
      }
    });
  }, [events, layers.events]);

  // Run all updates when data changes
  useEffect(() => { updateFlights(); }, [updateFlights]);
  useEffect(() => { updateShips(); }, [updateShips]);
  useEffect(() => { updateSatellites(); }, [updateSatellites]);
  useEffect(() => { updateGpsZones(); }, [updateGpsZones]);
  useEffect(() => { updateNoFlyZones(); }, [updateNoFlyZones]);
  useEffect(() => { updateEvents(); }, [updateEvents]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />
  );
}

// ─── Icon Generators ──────────────────────────────────────────────────────────

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function getAircraftIcon(type: string, heading: number, color: string, diverted?: boolean): string {
  const c = diverted ? "#ff8c00" : color;
  const rot = heading - 90; // SVG default points right
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="-14 -14 28 28">
    <g transform="rotate(${rot})">
      ${type === "military"
        ? `<polygon points="0,-11 7,5 0,2 -7,5" fill="${c}" stroke="#fff" stroke-width="0.8" opacity="0.95"/>
           <line x1="-7" y1="0" x2="7" y2="0" stroke="${c}" stroke-width="2"/>`
        : `<polygon points="0,-10 6,4 0,1 -6,4" fill="${c}" stroke="#fff" stroke-width="0.6" opacity="0.9"/>
           <line x1="-6" y1="0" x2="6" y2="0" stroke="${c}" stroke-width="1.5"/>`
      }
    </g>
    ${diverted ? `<circle cx="8" cy="-8" r="4" fill="#ff8c00" stroke="#fff" stroke-width="0.5"/>` : ""}
  </svg>`;
  return svgToDataUrl(svg);
}

function getShipIcon(type: string, color: string): string {
  const shapes: Record<string, string> = {
    tanker: `<rect x="-9" y="-4" width="18" height="8" rx="3" fill="${color}" stroke="#fff" stroke-width="0.5"/>
             <rect x="-5" y="-7" width="10" height="3" rx="1" fill="${color}"/>`,
    cargo: `<rect x="-8" y="-5" width="16" height="10" rx="2" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    warship: `<polygon points="0,-10 7,0 10,6 0,3 -10,6 -7,0" fill="${color}" stroke="#fff" stroke-width="0.5"/>`,
    carrier: `<rect x="-11" y="-3" width="22" height="6" rx="1" fill="${color}" stroke="#fff" stroke-width="0.5"/>
              <rect x="-2" y="-8" width="6" height="5" fill="${color}"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="-12 -12 24 24">
    ${shapes[type] || shapes.cargo}
  </svg>`;
  return svgToDataUrl(svg);
}

function getSatIcon(type: string, color: string): string {
  const isSpy = type === "spy";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="-14 -14 28 28">
    <rect x="-8" y="-2" width="7" height="4" fill="${color}" opacity="0.9"/>
    <rect x="1" y="-2" width="7" height="4" fill="${color}" opacity="0.9"/>
    <circle cx="0" cy="0" r="${isSpy ? 4 : 3}" fill="${color}" stroke="#fff" stroke-width="${isSpy ? 1.5 : 0.8}"/>
    ${isSpy ? `<circle cx="0" cy="0" r="7" fill="none" stroke="${color}" stroke-width="0.5" stroke-dasharray="2,2"/>` : ""}
  </svg>`;
  return svgToDataUrl(svg);
}

function getEventIcon(type: string, color: string): string {
  const shapes: Record<string, string> = {
    strike: `<polygon points="0,-12 3,-5 10,-8 6,-2 12,2 5,2 7,10 0,5 -7,10 -5,2 -12,2 -6,-2 -10,-8 -3,-5" fill="${color}" opacity="0.95"/>`,
    explosion: `<circle cx="0" cy="0" r="9" fill="${color}" opacity="0.85"/>
                <circle cx="0" cy="0" r="5" fill="#fff" opacity="0.6"/>`,
    closure: `<polygon points="0,-12 10,6 -10,6" fill="${color}" stroke="#fff" stroke-width="1"/>
              <rect x="-1.5" y="-5" width="3" height="7" fill="#fff"/>
              <circle cx="0" cy="5" r="1.5" fill="#fff"/>`,
    declaration: `<rect x="-9" y="-9" width="18" height="18" rx="2" fill="${color}" opacity="0.9" stroke="#fff" stroke-width="0.5"/>
                  <text x="0" y="5" text-anchor="middle" font-size="10" fill="#fff" font-weight="bold">!</text>`,
    diversion: `<path d="M-10,-10 L10,0 L-10,10 L-5,0 Z" fill="${color}" opacity="0.9"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-16 -16 32 32">
    ${shapes[type] || shapes.strike}
    <circle cx="0" cy="0" r="13" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
  </svg>`;
  return svgToDataUrl(svg);
}
