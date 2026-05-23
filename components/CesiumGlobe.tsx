"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";

type CursorMode = "navigate" | "select" | "zoom";
type MapStyle = "satellite" | "dark" | "street" | "terrain";
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

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Cesium: any;
    CESIUM_BASE_URL: string;
  }
}

const ION_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2MzBmNmVlYi0yZGNmLTQ5MjgtOWI2YS0xYWY0Y2MzZWM4NDAiLCJpZCI6NDM1NDczLCJzdWIiOiJNZXRhRnJvbnQiLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiV29ybGRWaWV3IiwiaWF0IjoxNzc5NTM4OTIyfQ.EZhwEKuonZtpGbqNvNFlRw5si4Wf-GhhL3vCf0b-tD4";

export default function CesiumGlobe({
  flights, ships, satellites, gpsZones, noFlyZones, events, layers, onTooltip, onEntityClick,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entitiesRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jamLayerRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nfzLayerRef = useRef<Map<string, any>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evtLayerRef = useRef<Map<string, any>>(new Map());
  const initRef = useRef(false);
  const [cursorMode, setCursorMode] = useState<CursorMode>("navigate");
  const cursorModeRef = useRef<CursorMode>("navigate");
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  const mapStyleRef = useRef<MapStyle>("satellite");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryDsRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countryLabelEntitiesRef = useRef<any[]>([]);
  const countryLoadingRef = useRef(false);
  // Always-current mirror of `layers` for async continuations
  const layersRef = useRef(layers);
  useEffect(() => { layersRef.current = layers; }, [layers]);

  // ─── Viewer Initialization ────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    if (typeof window === "undefined" || !window.Cesium) return;
    initRef.current = true;

    const Cesium = window.Cesium;
    // Set token before any Cesium API calls so Ion imagery loads on first request.
    Cesium.Ion.defaultAccessToken = ION_TOKEN;

    // useDefaultRenderLoop:false prevents Cesium from starting its rAF loop
    // mid-constructor — without this, React StrictMode's double-invoke fires a
    // dangling rAF frame into an incompletely-constructed viewer and crashes.
    let viewer: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      viewer = new Cesium.Viewer(containerRef.current, {
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
        useDefaultRenderLoop: false,
      });
      console.log("[WORLDVIEW] Cesium viewer created");
    } catch (e) {
      console.error("[WORLDVIEW] Viewer creation failed:", e);
      initRef.current = false;
      return;
    }

    // Darken Bing Maps imagery for the dark OSINT aesthetic
    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) {
      baseLayer.brightness = 0.5;
      baseLayer.saturation = 0.3;
    }

    viewer.scene.globe.enableLighting = false;

    // Initial camera — centred on Middle East
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(44.65, 30.32, 8_500_000),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_FOUR * 0.7, roll: 0 },
    });

    // Enable render loop only after full setup.
    viewer.useDefaultRenderLoop = true;

    // ResizeObserver keeps the WebGL drawing buffer in sync with the container's
    // actual CSS pixel size at all times — the root fix for the 8px-tall canvas
    // bug that previously made mouse events miss the globe entirely.
    const ro = new ResizeObserver(() => {
      if (!viewer.isDestroyed()) viewer.resize();
    });
    ro.observe(containerRef.current!);
    viewer.resize(); // sync immediately on first mount
    const canvas = viewer.scene.canvas;
    console.log(`[WORLDVIEW] Canvas: ${canvas.width}×${canvas.height} | container: ${containerRef.current?.clientWidth}×${containerRef.current?.clientHeight}`);
    viewerRef.current = viewer;
    console.log("[WORLDVIEW] Render loop started, viewer ready");

    // ── Input handlers ────────────────────────────────────────────────────────
    const handler = new Cesium.ScreenSpaceEventHandler(canvas);

    // Hover: change cursor based on mode + whether an entity is under the pointer
    handler.setInputAction((m: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (viewer.isDestroyed()) return;
      const picked = viewer.scene.pick(m.endPosition);
      const mode = cursorModeRef.current;
      if (picked?.id?._meta) {
        canvas.style.cursor = "pointer";
      } else if (mode === "navigate") {
        canvas.style.cursor = "grab";
      } else if (mode === "select") {
        canvas.style.cursor = "crosshair";
      } else {
        canvas.style.cursor = "zoom-in";
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Grab → grabbing while dragging in navigate mode
    handler.setInputAction(() => {
      if (cursorModeRef.current === "navigate") canvas.style.cursor = "grabbing";
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
    handler.setInputAction(() => {
      if (cursorModeRef.current === "navigate") canvas.style.cursor = "grab";
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    // Click: entity tooltip / zoom-to-point
    handler.setInputAction((movement: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const picked = viewer.scene.pick(movement.position);
      const meta = picked?.id?._meta;
      const mode = cursorModeRef.current;

      if (mode === "zoom") {
        // Fly to clicked ground position, halving current altitude
        const ray = viewer.camera.getPickRay(movement.position);
        const pos = ray && viewer.scene.globe.pick(ray, viewer.scene);
        if (pos) {
          const carto = Cesium.Cartographic.fromCartesian(pos);
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromRadians(
              carto.longitude, carto.latitude,
              viewer.camera.positionCartographic.height * 0.4
            ),
            duration: 0.8,
          });
        }
        return;
      }

      if (meta) {
        const rect = containerRef.current!.getBoundingClientRect();
        onTooltip({
          x: movement.position.x + rect.left,
          y: movement.position.y + rect.top,
          title: meta.title,
          rows: meta.rows,
        });
        onEntityClick?.(meta.type, meta.id);
      } else {
        onTooltip(null);
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(() => {
      onTooltip(null);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // Capture ref collections now so the cleanup closure holds stable references,
    // satisfying the react-hooks/exhaustive-deps lint rule for ref cleanup.
    const entities = entitiesRef.current;
    const nfzLayer = nfzLayerRef.current;
    const evtLayer = evtLayerRef.current;

    return () => {
      ro.disconnect();
      handler.destroy();
      if (!viewer.isDestroyed()) viewer.destroy();
      viewerRef.current = null;
      initRef.current = false;
      // Clear stale entity refs so the next mount adds fresh entities to the new viewer
      entities.clear();
      jamLayerRef.current = [];
      nfzLayer.clear();
      evtLayer.clear();
      countryDsRef.current = null;
      countryLabelEntitiesRef.current = [];
      countryLoadingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getViewer = () => {
    const v = viewerRef.current;
    return v && !v.isDestroyed() ? v : null;
  };

  // ─── Flights ──────────────────────────────────────────────────────────────
  const updateFlights = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;
    const show = layers.commercialFlights || layers.militaryFlights;

    if (!show) {
      entitiesRef.current.forEach((e, key) => {
        if (key.startsWith("f") || key.startsWith("m")) e.show = false;
      });
      return;
    }

    flights.forEach((flight) => {
      const showThis =
        (flight.type === "commercial" && layers.commercialFlights) ||
        (flight.type === "military" && layers.militaryFlights);
      const pos = Cesium.Cartesian3.fromDegrees(flight.lon, flight.lat, flight.altitude * 0.3048);
      const color = flight.diverted
        ? Cesium.Color.fromCssColorString("#ff8c00")
        : Cesium.Color.fromCssColorString(flight.color);
      const existing = entitiesRef.current.get(flight.id);

      if (!existing) {
        const entity = viewer.entities.add({
          id: flight.id,
          position: pos,
          billboard: {
            image: getAircraftIcon(flight.type, flight.heading, flight.color, flight.diverted),
            width: flight.type === "military" ? 34 : 36,
            height: flight.type === "military" ? 34 : 36,
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
        if (flight.diverted) existing.label.fillColor = Cesium.Color.fromCssColorString("#ff8c00");
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
    console.log(`[WORLDVIEW] Flights updated: ${flights.length} tracks`);
  }, [flights, layers]);

  // ─── Ships ────────────────────────────────────────────────────────────────
  const updateShips = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    ships.forEach((ship) => {
      const existing = entitiesRef.current.get(ship.id);
      const pos = Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 0);
      const color = Cesium.Color.fromCssColorString(ship.color);

      const shipSz = shipIconSize(ship.type);
      if (!existing) {
        const entity = viewer.entities.add({
          id: ship.id,
          position: pos,
          billboard: {
            image: getShipIcon(ship.type, ship.color, ship.heading),
            width: shipSz, height: shipSz,
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
        existing.billboard.image = getShipIcon(ship.type, ship.color, ship.heading);
        existing.label.show = layers.ships;
        existing._meta.rows[4] = ["Position", `${ship.lat.toFixed(2)}°N ${ship.lon.toFixed(2)}°E`];
      }
    });
    console.log(`[WORLDVIEW] Ships updated: ${ships.length} vessels`);
  }, [ships, layers.ships]);

  // ─── Satellites ───────────────────────────────────────────────────────────
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
    console.log(`[WORLDVIEW] Satellites updated: ${satellites.length} objects`);
  }, [satellites, layers.satellites]);

  // ─── GPS Jamming Zones ────────────────────────────────────────────────────
  const updateGpsZones = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    jamLayerRef.current.forEach((e) => viewer.entities.remove(e));
    jamLayerRef.current = [];

    if (!layers.gpsJamming) return;

    gpsZones.forEach((zone) => {
      const outer = viewer.entities.add({
        id: `jam_${zone.id}_${Date.now()}`,
        position: Cesium.Cartesian3.fromDegrees(zone.center[1], zone.center[0], 0),
        ellipse: {
          semiMajorAxis: zone.radiusKm * 1000,
          semiMinorAxis: zone.radiusKm * 1000,
          material: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.08 + zone.intensity * 0.15),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.3 + zone.intensity * 0.4),
          outlineWidth: 1,
          height: 0,
        },
      });
      const inner = viewer.entities.add({
        id: `jam_inner_${zone.id}_${Date.now()}`,
        position: Cesium.Cartesian3.fromDegrees(zone.center[1], zone.center[0], 0),
        ellipse: {
          semiMajorAxis: zone.radiusKm * 300,
          semiMinorAxis: zone.radiusKm * 300,
          material: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.25 + zone.intensity * 0.3),
          height: 0,
        },
      });
      jamLayerRef.current.push(outer, inner);
    });
  }, [gpsZones, layers.gpsJamming]);

  // ─── No-Fly Zones ─────────────────────────────────────────────────────────
  const updateNoFlyZones = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    noFlyZones.forEach((nfz) => {
      const show = layers.noFlyZones && nfz.active;
      const positions = nfz.polygon.flatMap(([lon, lat]) => [lon, lat]);
      const existing = nfzLayerRef.current.get(nfz.id);

      if (!existing) {
        const entity = viewer.entities.add({
          id: `nfz_${nfz.id}`,
          polygon: {
            hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
            material: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.08),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString("#ff3366").withAlpha(0.6),
            outlineWidth: 2,
            height: 0,
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

  // ─── Event Markers ────────────────────────────────────────────────────────
  const updateEvents = useCallback(() => {
    const viewer = getViewer();
    if (!viewer) return;
    const Cesium = window.Cesium;

    events.forEach((evt) => {
      const show = layers.events && evt.active;
      const color =
        evt.severity === "critical" ? "#ff3366" :
        evt.severity === "high"     ? "#ff8c00" : "#ffd700";
      const existing = evtLayerRef.current.get(evt.id);

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
          ellipse: evt.severity === "critical" ? {
            semiMajorAxis: 80000,
            semiMinorAxis: 80000,
            material: Cesium.Color.fromCssColorString(color).withAlpha(0.15),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(color).withAlpha(0.5),
            outlineWidth: 1,
            height: 0,
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

  // ─── Country Boundaries + Labels ─────────────────────────────────────────
  const loadCountryLayers = useCallback(() => {
    const v = getViewer();
    if (!v || countryLoadingRef.current) return;
    if (countryDsRef.current) {
      // Already loaded — just sync visibility
      countryDsRef.current.show = layersRef.current.countryBoundaries;
      countryLabelEntitiesRef.current.forEach((e) => {
        e.label.show = layersRef.current.countryLabels;
      });
      return;
    }

    countryLoadingRef.current = true;
    const Cesium = window.Cesium;

    Cesium.GeoJsonDataSource.load(
      "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson",
      {
        stroke: Cesium.Color.fromCssColorString("#00d4ff").withAlpha(0.65),
        fill: Cesium.Color.fromCssColorString("#00d4ff").withAlpha(0.05),
        strokeWidth: 1.5,
        clampToGround: true,
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).then((ds: any) => {
      if (v.isDestroyed()) { countryLoadingRef.current = false; return; }

      ds.show = layersRef.current.countryBoundaries;
      v.dataSources.add(ds).then(() => {
        countryDsRef.current = ds;
        countryLoadingRef.current = false;

        // Add a label entity for each country using Natural Earth label coords
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ds.entities.values.forEach((entity: any) => {
          const props = entity.properties;
          const name: string =
            props?.ADMIN?.getValue() ??
            props?.NAME?.getValue() ??
            props?.name?.getValue() ??
            entity.name;
          if (!name || v.isDestroyed()) return;

          // Prefer the Natural Earth label coords; fall back to polygon centroid
          // so small countries (Qatar, UAE, Bahrain…) don't bleed into neighbours.
          let labelPos: any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const lx: number = props?.LABEL_X?.getValue();
          const ly: number = props?.LABEL_Y?.getValue();
          if (lx != null && !isNaN(lx) && ly != null && !isNaN(ly)) {
            labelPos = Cesium.Cartesian3.fromDegrees(lx, ly, 0);
          } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const hier = entity.polygon?.hierarchy?.getValue?.(Cesium.JulianDate.now()) as any;
            if (hier?.positions?.length) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const pts: any[] = hier.positions;
              const n = pts.length;
              const ax = pts.reduce((s: number, p: any) => s + p.x, 0) / n;
              const ay = pts.reduce((s: number, p: any) => s + p.y, 0) / n;
              const az = pts.reduce((s: number, p: any) => s + p.z, 0) / n;
              const carto = Cesium.Cartographic.fromCartesian(new Cesium.Cartesian3(ax, ay, az));
              labelPos = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0);
            }
          }
          if (!labelPos) return;

          const labelEntity = v.entities.add({
            position: labelPos,
            label: {
              text: name.toUpperCase(),
              font: "bold 12px Orbitron, monospace",
              fillColor: Cesium.Color.fromCssColorString("#7ab8d4"),
              outlineColor: Cesium.Color.fromCssColorString("#050a0f"),
              outlineWidth: 4,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              // Visible from ~300 km to 15 000 km (covers initial 8.5M m camera)
              scaleByDistance: new Cesium.NearFarScalar(300_000, 1.3, 10_000_000, 0.55),
              translucencyByDistance: new Cesium.NearFarScalar(5_000_000, 1.0, 15_000_000, 0.0),
              show: layersRef.current.countryLabels,
            },
          });
          countryLabelEntitiesRef.current.push(labelEntity);
        });

        console.log(
          `[WORLDVIEW] Country layers loaded: ${ds.entities.values.length} countries`
        );
      });
    }).catch((err: unknown) => {
      countryLoadingRef.current = false;
      console.warn("[WORLDVIEW] Country boundaries failed to load:", err);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateCountryVisibility = useCallback(() => {
    if (countryDsRef.current) {
      countryDsRef.current.show = layers.countryBoundaries;
    }
    countryLabelEntitiesRef.current.forEach((e) => {
      e.label.show = layers.countryLabels;
    });
  }, [layers.countryBoundaries, layers.countryLabels]);

  // Load once on mount (after viewer is ready), then re-run only for visibility
  useEffect(() => { loadCountryLayers(); }, [loadCountryLayers]);
  useEffect(() => { updateCountryVisibility(); }, [updateCountryVisibility]);

  // ─── Trigger updates whenever data or layer visibility changes ────────────
  useEffect(() => { updateFlights(); }, [updateFlights]);
  useEffect(() => { updateShips(); }, [updateShips]);
  useEffect(() => { updateSatellites(); }, [updateSatellites]);
  useEffect(() => { updateGpsZones(); }, [updateGpsZones]);
  useEffect(() => { updateNoFlyZones(); }, [updateNoFlyZones]);
  useEffect(() => { updateEvents(); }, [updateEvents]);

  // ─── Cursor Mode ──────────────────────────────────────────────────────────
  const changeCursorMode = (mode: CursorMode) => {
    cursorModeRef.current = mode;
    setCursorMode(mode);
    const v = getViewer();
    if (!v) return;
    const canvas = v.scene.canvas;
    canvas.style.cursor = mode === "navigate" ? "grab" : mode === "select" ? "crosshair" : "zoom-in";
    // Keep camera navigation active in all modes so the map always stays pannable
    v.scene.screenSpaceCameraController.enableInputs = true;
  };

  // ─── Map Style ────────────────────────────────────────────────────────────
  const changeMapStyle = useCallback(async (style: MapStyle) => {
    const v = getViewer();
    if (!v) return;
    const Cesium = window.Cesium;
    mapStyleRef.current = style;
    setMapStyle(style);
    v.imageryLayers.removeAll();
    try {
      let provider;
      switch (style) {
        case "satellite":
          provider = await Cesium.IonImageryProvider.fromAssetId(2);
          break;
        case "dark":
          provider = new Cesium.UrlTemplateImageryProvider({
            url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            maximumLevel: 19,
          });
          break;
        case "street":
          provider = new Cesium.UrlTemplateImageryProvider({
            url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            maximumLevel: 19,
          });
          break;
        case "terrain":
          provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
            "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer"
          );
          break;
      }
      if (v.isDestroyed()) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageryLayer = new Cesium.ImageryLayer(provider as any);
      v.imageryLayers.add(imageryLayer);
      if (style === "satellite") {
        imageryLayer.brightness = 0.5;
        imageryLayer.saturation = 0.3;
      }
    } catch (err) {
      console.error("[WORLDVIEW] Map style change failed:", err);
    }
  }, []);

  // ─── Camera Controls ──────────────────────────────────────────────────────
  const zoomIn = () => {
    const v = getViewer();
    if (!v) return;
    v.camera.zoomIn(v.camera.positionCartographic.height * 0.4);
  };

  const zoomOut = () => {
    const v = getViewer();
    if (!v) return;
    v.camera.zoomOut(v.camera.positionCartographic.height * 0.6);
  };

  const resetView = () => {
    const v = getViewer();
    if (!v) return;
    const Cesium = window.Cesium;
    v.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(44.65, 30.32, 8_500_000),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_FOUR * 0.7, roll: 0 },
      duration: 1.5,
    });
  };

  const resetNorth = () => {
    const v = getViewer();
    if (!v) return;
    v.camera.flyTo({
      destination: v.camera.positionWC,
      orientation: {
        heading: 0,
        pitch: v.camera.pitch,
        roll: 0,
      },
      duration: 0.8,
    });
  };

  const toggleSceneMode = () => {
    const v = getViewer();
    if (!v) return;
    const Cesium = window.Cesium;
    if (v.scene.mode === Cesium.SceneMode.SCENE3D) {
      v.scene.morphTo2D(0.5);
    } else {
      v.scene.morphTo3D(0.5);
    }
  };

  const baseBtn: React.CSSProperties = {
    width: "34px",
    height: "34px",
    background: "rgba(5, 10, 15, 0.88)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "#1a3a5c",
    borderRadius: "4px",
    color: "#00d4ff",
    fontFamily: "'Space Mono', monospace",
    fontSize: "15px",
    lineHeight: 1,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(8px)",
    transition: "background 0.15s, border-color 0.15s",
    flexShrink: 0,
  };

  const activeBtn: React.CSSProperties = {
    ...baseBtn,
    background: "rgba(0,212,255,0.18)",
    borderColor: "#00d4ff",
    boxShadow: "0 0 8px rgba(0,212,255,0.3)",
  };

  const hoverOn  = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
    if (!active) e.currentTarget.style.background = "rgba(0,212,255,0.10)";
  };
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>, active: boolean) => {
    e.currentTarget.style.background = active ? "rgba(0,212,255,0.18)" : "rgba(5,10,15,0.88)";
  };

  return (
    <>
      {/* Cesium canvas container — must be pointer-events:auto for mouse events */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, pointerEvents: "auto" }}
      />

      {/* ── Cursor / Tool Mode Palette (left side) ── */}
      <div style={{
        position: "absolute",
        left: "14px",
        top: "50%",
        transform: "translateY(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        zIndex: 10,
        pointerEvents: "auto",
      }}>
        {/* Label */}
        <div style={{
          fontSize: "7px", color: "#3d7a9e", letterSpacing: "0.12em",
          fontFamily: "var(--font-display)", textAlign: "center", marginBottom: "2px",
        }}>TOOL</div>

        {/* Navigate */}
        <button
          style={cursorMode === "navigate" ? activeBtn : baseBtn}
          title="Navigate — pan, zoom, rotate"
          onMouseEnter={e => hoverOn(e, cursorMode === "navigate")}
          onMouseLeave={e => hoverOff(e, cursorMode === "navigate")}
          onClick={() => changeCursorMode("navigate")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 1v3M8 12v3M1 8h3M12 8h3" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2" stroke="#00d4ff" strokeWidth="1" strokeLinecap="round"/>
            <circle cx="8" cy="8" r="2.5" stroke="#00d4ff" strokeWidth="1.2"/>
          </svg>
        </button>

        {/* Select */}
        <button
          style={cursorMode === "select" ? activeBtn : baseBtn}
          title="Select — click to inspect entities"
          onMouseEnter={e => hoverOn(e, cursorMode === "select")}
          onMouseLeave={e => hoverOff(e, cursorMode === "select")}
          onClick={() => changeCursorMode("select")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 2l9 5.5-4 1-2.5 4L3 2z" fill="#00d4ff" opacity="0.85"/>
            <path d="M9 9.5l4 4" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Zoom */}
        <button
          style={cursorMode === "zoom" ? activeBtn : baseBtn}
          title="Zoom — click map to zoom in"
          onMouseEnter={e => hoverOn(e, cursorMode === "zoom")}
          onMouseLeave={e => hoverOff(e, cursorMode === "zoom")}
          onClick={() => changeCursorMode("zoom")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="#00d4ff" strokeWidth="1.2"/>
            <path d="M11 11l3 3" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M5 7h4M7 5v4" stroke="#00d4ff" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Divider */}
        <div style={{ height: "1px", background: "#1a3a5c", margin: "4px 0" }} />

        {/* Mode label */}
        <div style={{
          fontSize: "7px", color: "#00d4ff", letterSpacing: "0.08em",
          fontFamily: "var(--font-display)", textAlign: "center", opacity: 0.8,
        }}>
          {cursorMode === "navigate" ? "NAV" : cursorMode === "select" ? "SEL" : "ZM+"}
        </div>
      </div>

      {/* ── Map Style Switcher (top-right) ── */}
      <div style={{
        position: "absolute",
        right: "14px",
        top: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        zIndex: 10,
        pointerEvents: "auto",
      }}>
        <div style={{
          fontSize: "7px", color: "#3d7a9e", letterSpacing: "0.12em",
          fontFamily: "var(--font-display)", textAlign: "center", marginBottom: "2px",
        }}>MAP</div>
        {([
          { id: "satellite" as MapStyle, label: "SAT", title: "Satellite imagery" },
          { id: "dark"      as MapStyle, label: "DRK", title: "Dark / OSINT" },
          { id: "street"    as MapStyle, label: "STR", title: "Street map (OSM)" },
          { id: "terrain"   as MapStyle, label: "TRN", title: "Terrain / Topo" },
        ] as { id: MapStyle; label: string; title: string }[]).map(({ id, label, title }) => (
          <button
            key={id}
            title={title}
            style={mapStyle === id ? activeBtn : { ...baseBtn, fontSize: "9px", letterSpacing: "0.04em" }}
            onMouseEnter={e => hoverOn(e, mapStyle === id)}
            onMouseLeave={e => hoverOff(e, mapStyle === id)}
            onClick={() => changeMapStyle(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Navigation Controls (bottom-right) ── */}
      <div style={{
        position: "absolute",
        right: "14px",
        bottom: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        zIndex: 10,
        pointerEvents: "auto",
      }}>
        <button style={baseBtn} title="Zoom in"
          onMouseEnter={e => hoverOn(e, false)} onMouseLeave={e => hoverOff(e, false)}
          onClick={zoomIn}>+</button>
        <button style={baseBtn} title="Zoom out"
          onMouseEnter={e => hoverOn(e, false)} onMouseLeave={e => hoverOff(e, false)}
          onClick={zoomOut}>−</button>

        <div style={{ height: "1px", background: "#1a3a5c", margin: "2px 0" }} />

        <button style={baseBtn} title="Reset north"
          onMouseEnter={e => hoverOn(e, false)} onMouseLeave={e => hoverOff(e, false)}
          onClick={resetNorth}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polygon points="7,1 9.5,7 7,5.5 4.5,7" fill="#00d4ff"/>
            <polygon points="7,13 4.5,7 7,8.5 9.5,7" fill="#3d7a9e"/>
            <circle cx="7" cy="7" r="1.5" fill="#00d4ff"/>
          </svg>
        </button>

        <button style={baseBtn} title="Home view"
          onMouseEnter={e => hoverOn(e, false)} onMouseLeave={e => hoverOff(e, false)}
          onClick={resetView}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L1 6h2v6h8V6h2L7 1z" fill="#00d4ff" opacity="0.9"/>
          </svg>
        </button>

        <button
          style={{ ...baseBtn, fontSize: "9px", letterSpacing: "0.04em" }}
          title="Toggle 2D / 3D"
          onMouseEnter={e => hoverOn(e, false)} onMouseLeave={e => hoverOff(e, false)}
          onClick={toggleSceneMode}>3D</button>
      </div>
    </>
  );
}

// ─── Icon Generators ──────────────────────────────────────────────────────────

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Aircraft icons: nose drawn pointing toward -Y (up on screen), so rotate(heading) = north when heading=0
function getAircraftIcon(type: string, heading: number, color: string, diverted?: boolean): string {
  const c = diverted ? "#ff8c00" : color;

  const body = type === "military"
    // ── Fighter jet (delta-wing, twin tails) ──────────────────────────────
    ? `<path d="M0,-14 C0.8,-10 1.5,-4 1.5,4 L1,9 0,11 -1,9 -1.5,4 C-1.5,-4 -0.8,-10 0,-14Z"
         fill="${c}" stroke="rgba(255,255,255,0.3)" stroke-width="0.4"/>
       <path d="M1,-1 C4,2 10,6 15,10 L14,11 C9,8 4,5 1.5,2Z" fill="${c}" opacity="0.9"/>
       <path d="M-1,-1 C-4,2 -10,6 -15,10 L-14,11 C-9,8 -4,5 -1.5,2Z" fill="${c}" opacity="0.9"/>
       <path d="M1,6 L3.5,12 2.5,12.5 0.8,7Z" fill="${c}"/>
       <path d="M-1,6 L-3.5,12 -2.5,12.5 -0.8,7Z" fill="${c}"/>
       <path d="M1.2,1 C2.5,3 2.5,5 1.5,5.5" stroke="${c}" stroke-width="1.8" fill="none" opacity="0.7"/>
       <path d="M-1.2,1 C-2.5,3 -2.5,5 -1.5,5.5" stroke="${c}" stroke-width="1.8" fill="none" opacity="0.7"/>
       <ellipse cx="0" cy="-9" rx="0.9" ry="2.5" fill="rgba(150,230,255,0.55)"/>
       <ellipse cx="0" cy="10" rx="1.4" ry="1" fill="${c}" opacity="0.3"/>`
    // ── Commercial airliner (swept wings, 2 engine pods) ──────────────────
    : `<path d="M0,-13 C1.2,-9 2,-2 2,4 C2,8 1.2,11 0,13 C-1.2,11 -2,8 -2,4 C-2,-2 -1.2,-9 0,-13Z"
         fill="${c}" stroke="rgba(255,255,255,0.28)" stroke-width="0.4"/>
       <path d="M-2,0 C-5,1 -10,4 -14,7 L-13.5,8.5 C-9,6 -4.5,3.5 -2.5,2Z" fill="${c}" opacity="0.88"/>
       <path d="M2,0 C5,1 10,4 14,7 L13.5,8.5 C9,6 4.5,3.5 2.5,2Z" fill="${c}" opacity="0.88"/>
       <ellipse cx="-8.5" cy="3.5" rx="1.2" ry="2.8" fill="${c}" stroke="rgba(255,255,255,0.18)" stroke-width="0.4"/>
       <ellipse cx="8.5" cy="3.5" rx="1.2" ry="2.8" fill="${c}" stroke="rgba(255,255,255,0.18)" stroke-width="0.4"/>
       <path d="M-2,9 C-4,10 -6.5,11 -7.5,11.5 L-7,12 C-5.5,11.5 -3.5,10.5 -2,10Z" fill="${c}" opacity="0.82"/>
       <path d="M2,9 C4,10 6.5,11 7.5,11.5 L7,12 C5.5,11.5 3.5,10.5 2,10Z" fill="${c}" opacity="0.82"/>
       <ellipse cx="0" cy="-10.5" rx="1" ry="1.8" fill="rgba(180,240,255,0.5)"/>`;

  const sz = type === "military" ? 34 : 36;
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sz * 2}" height="${sz * 2}" viewBox="-16 -16 32 32">
      <g transform="rotate(${heading})">${body}</g>
      ${diverted
        ? `<circle cx="12" cy="-12" r="4.5" fill="#ff8c00" stroke="white" stroke-width="0.8"/>
           <text x="12" y="-9.5" text-anchor="middle" font-size="6" font-weight="bold" fill="white">!</text>`
        : ""}
    </svg>`
  );
}

// shipIconSize exported so updateShips can set billboard width/height consistently
function shipIconSize(type: string): number {
  return type === "carrier" ? 40 : type === "warship" ? 28 : 34;
}

// Ship icons: bow pointing toward -Y (north when heading=0), rotate(heading) for orientation
function getShipIcon(type: string, color: string, heading = 0): string {
  const c = color;
  const bodies: Record<string, string> = {
    // ── Oil tanker: long oval + circular deck tanks + stern bridge ────────
    tanker: `
      <path d="M0,-15 Q6.5,-13 7,-4 L7,9 Q5.5,13 0,15 Q-5.5,13 -7,9 L-7,-4 Q-6.5,-13 0,-15Z"
        fill="${c}" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
      <circle cx="0" cy="-8" r="3.2" fill="${c}" opacity="0.55" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
      <circle cx="0" cy="-0.5" r="3.2" fill="${c}" opacity="0.55" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
      <circle cx="0" cy="6.5" r="2.7" fill="${c}" opacity="0.55" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
      <rect x="-2.2" y="10.5" width="4.4" height="3.5" rx="0.5" fill="${c}" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
      <line x1="0" y1="-11" x2="0" y2="9" stroke="rgba(255,255,255,0.1)" stroke-width="0.6"/>`,
    // ── Cargo ship: wide hull + 3 rectangular hatches + stern house ───────
    cargo: `
      <path d="M0,-13 Q5.5,-12 6.5,-3 L6.5,9 Q5,13 0,14 Q-5,13 -6.5,9 L-6.5,-3 Q-5.5,-12 0,-13Z"
        fill="${c}" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
      <rect x="-3.5" y="-9.5" width="7" height="4.5" rx="0.4" fill="${c}" opacity="0.5" stroke="rgba(255,255,255,0.22)" stroke-width="0.4"/>
      <rect x="-3.5" y="-2.5" width="7" height="4.5" rx="0.4" fill="${c}" opacity="0.5" stroke="rgba(255,255,255,0.22)" stroke-width="0.4"/>
      <rect x="-3" y="4.5" width="6" height="3.5" rx="0.4" fill="${c}" opacity="0.5" stroke="rgba(255,255,255,0.22)" stroke-width="0.4"/>
      <rect x="-2.5" y="9.5" width="5" height="3.5" rx="0.5" fill="${c}" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>`,
    // ── Warship/destroyer: narrow hull + gun + bridge + radar ─────────────
    warship: `
      <path d="M0,-15 Q2.2,-12 2.8,-4 L3,7 Q2,12 0,14 Q-2,12 -3,7 L-2.8,-4 Q-2.2,-12 0,-15Z"
        fill="${c}" stroke="rgba(255,255,255,0.3)" stroke-width="0.5"/>
      <circle cx="0" cy="-8" r="2.2" fill="${c}" stroke="rgba(255,255,255,0.5)" stroke-width="0.6"/>
      <rect x="-0.5" y="-13.5" width="1" height="5.5" fill="${c}" stroke="rgba(255,255,255,0.25)" stroke-width="0.3"/>
      <rect x="-2.5" y="-2.5" width="5" height="5" rx="0.4" fill="${c}" stroke="rgba(255,255,255,0.4)" stroke-width="0.5"/>
      <line x1="0" y1="-3" x2="0" y2="-6" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/>
      <circle cx="0" cy="-6.5" r="0.7" fill="rgba(255,255,255,0.5)"/>
      <rect x="-2" y="7" width="4" height="3" rx="0.3" fill="${c}" opacity="0.75"/>`,
    // ── Aircraft carrier: massive flat deck + island + angled deck ────────
    carrier: `
      <path d="M0,-16 Q10,-14 11,-5 L11,11 Q8,15 0,16 Q-8,15 -11,11 L-11,-5 Q-10,-14 0,-16Z"
        fill="${c}" stroke="rgba(255,255,255,0.2)" stroke-width="0.5"/>
      <rect x="5.5" y="-7" width="4.5" height="9" rx="0.5" fill="${c}" stroke="rgba(255,255,255,0.5)" stroke-width="0.6"/>
      <line x1="-9" y1="3" x2="3" y2="-14" stroke="rgba(255,255,255,0.14)" stroke-width="0.8"/>
      <line x1="-5" y1="-14" x2="-5" y2="-2" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"/>
      <line x1="0" y1="-15" x2="0" y2="-3" stroke="rgba(255,255,255,0.12)" stroke-width="0.5"/>
      <line x1="7.5" y1="-8" x2="7.5" y2="-12" stroke="rgba(255,255,255,0.55)" stroke-width="0.7"/>`,
  };

  const sz = shipIconSize(type);
  const body = bodies[type] ?? bodies.cargo;
  return svgToDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${sz * 2}" height="${sz * 2}" viewBox="-16 -16 32 32">
      <g transform="rotate(${heading})">${body}</g>
    </svg>`
  );
}

function getSatIcon(type: string, color: string): string {
  const isSpy = type === "spy";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="-14 -14 28 28">
    <rect x="-8" y="-2" width="7" height="4" fill="${color}" opacity="0.9"/>
    <rect x="1"  y="-2" width="7" height="4" fill="${color}" opacity="0.9"/>
    <circle cx="0" cy="0" r="${isSpy ? 4 : 3}" fill="${color}" stroke="#fff" stroke-width="${isSpy ? 1.5 : 0.8}"/>
    ${isSpy ? `<circle cx="0" cy="0" r="7" fill="none" stroke="${color}" stroke-width="0.5" stroke-dasharray="2,2"/>` : ""}
  </svg>`;
  return svgToDataUrl(svg);
}

function getEventIcon(type: string, color: string): string {
  const shapes: Record<string, string> = {
    strike:      `<polygon points="0,-12 3,-5 10,-8 6,-2 12,2 5,2 7,10 0,5 -7,10 -5,2 -12,2 -6,-2 -10,-8 -3,-5" fill="${color}" opacity="0.95"/>`,
    explosion:   `<circle cx="0" cy="0" r="9" fill="${color}" opacity="0.85"/>
                  <circle cx="0" cy="0" r="5" fill="#fff" opacity="0.6"/>`,
    closure:     `<polygon points="0,-12 10,6 -10,6" fill="${color}" stroke="#fff" stroke-width="1"/>
                  <rect x="-1.5" y="-5" width="3" height="7" fill="#fff"/>
                  <circle cx="0" cy="5" r="1.5" fill="#fff"/>`,
    declaration: `<rect x="-9" y="-9" width="18" height="18" rx="2" fill="${color}" opacity="0.9" stroke="#fff" stroke-width="0.5"/>
                  <text x="0" y="5" text-anchor="middle" font-size="10" fill="#fff" font-weight="bold">!</text>`,
    diversion:   `<path d="M-10,-10 L10,0 L-10,10 L-5,0 Z" fill="${color}" opacity="0.9"/>`,
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="-16 -16 32 32">
    ${shapes[type] ?? shapes.strike}
    <circle cx="0" cy="0" r="13" fill="none" stroke="${color}" stroke-width="1" opacity="0.5"/>
  </svg>`;
  return svgToDataUrl(svg);
}
