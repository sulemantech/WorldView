"use client";
// ============================================================
// WORLDVIEW — Main Page
// Orchestrates globe, data streams, playback, and UI panels
// ============================================================

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar";
import EventLog, { LogEntry } from "@/components/EventLog";
import PlaybackControls from "@/components/PlaybackControls";
import AIAgentPanel from "@/components/AIAgentPanel";
import Tooltip from "@/components/Tooltip";
import type { AppMode, LayerVisibility } from "@/lib/cesiumHelpers";
import {
  FlightTrack, Ship, Satellite, GpsJamZone, NoFlyZone, EventMarker,
  initializeFlights, initializeShips, initializeSatellites,
  GPS_JAM_ZONES_INITIAL, NO_FLY_ZONES, PLAYBACK_EVENTS,
  AI_AGENT_MESSAGES, interpolatePath, bearing, satPosition,
  COMMERCIAL_FLIGHT_DEFS, MILITARY_FLIGHT_DEFS, SATELLITE_DEFS,
} from "@/lib/dataGenerators";
import { DEFAULT_LAYERS } from "@/lib/cesiumHelpers";

// Dynamically import Cesium globe (client only, no SSR)
const CesiumGlobe = dynamic(() => import("@/components/CesiumGlobe"), {
  ssr: false,
  loading: () => (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexDirection: "column", gap: "16px",
      background: "var(--bg-dark)",
    }}>
      <div style={{
        width: "60px", height: "60px",
        borderRadius: "50%",
        border: "2px solid var(--border)",
        borderTop: "2px solid var(--accent-cyan)",
        animation: "radar-sweep 1s linear infinite",
      }} />
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: "12px",
        color: "var(--accent-cyan)",
        letterSpacing: "0.2em",
      }}>
        INITIALIZING GLOBE...
      </span>
    </div>
  ),
});

// Cesium script loading state
let cesiumLoaded = false;
let cesiumLoadCallbacks: (() => void)[] = [];

function ensureCesium(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return;
    if (window.Cesium && cesiumLoaded) { resolve(); return; }
    if (cesiumLoaded) { resolve(); return; }

    cesiumLoadCallbacks.push(resolve);

    if (document.getElementById("cesium-script")) return;

    // Set base URL before loading
    (window as any).CESIUM_BASE_URL = "/cesium/";

    // Load Cesium CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.id = "cesium-script";
    script.src = "https://cesium.com/downloads/cesiumjs/releases/1.122/Build/Cesium/Cesium.js";
    script.onload = () => {
      cesiumLoaded = true;
      cesiumLoadCallbacks.forEach((cb) => cb());
      cesiumLoadCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function formatUTCTime(date: Date) {
  return date.toUTCString().replace("GMT", "").trim();
}

function formatLogTime(date: Date) {
  return date.toISOString().substring(11, 19) + "Z";
}

export default function WorldviewPage() {
  const [cesiumReady, setCesiumReady] = useState(false);
  const [mode, setMode] = useState<AppMode>("live");
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [flights, setFlights] = useState<FlightTrack[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [gpsZones, setGpsZones] = useState<GpsJamZone[]>(GPS_JAM_ZONES_INITIAL);
  const [noFlyZones, setNoFlyZones] = useState<NoFlyZone[]>(NO_FLY_ZONES);
  const [events, setEvents] = useState<EventMarker[]>(PLAYBACK_EVENTS.map(e => ({ ...e, active: false })));
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; rows: [string, string][] } | null>(null);
  const [systemTime, setSystemTime] = useState("");
  const [threatLevel, setThreatLevel] = useState<"GREEN" | "YELLOW" | "ORANGE" | "RED">("GREEN");
  const [playbackTime, setPlaybackTime] = useState(0); // 0-120 mins
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [aiMessages, setAiMessages] = useState<{ id: string; text: string; type: string }[]>([]);

  const flightsRef = useRef(flights);
  const shipsRef = useRef(ships);
  const satsRef = useRef(satellites);
  const playbackRef = useRef({ time: 0, playing: false, speed: 5 });
  const liveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track last triggered playback events
  const triggeredEventsRef = useRef<Set<string>>(new Set());

  // ─── Load Cesium ───────────────────────────────────────────────────────────
  useEffect(() => {
    ensureCesium().then(() => setCesiumReady(true));
  }, []);

  // ─── Initialize data ───────────────────────────────────────────────────────
  useEffect(() => {
    const f = initializeFlights();
    const s = initializeShips();
    const sat = initializeSatellites();
    setFlights(f);
    setShips(s);
    setSatellites(sat);
    flightsRef.current = f;
    shipsRef.current = s;
    satsRef.current = sat;

    addLog("system", "WORLDVIEW OSINT platform initialized");
    addLog("ai", "Sensor fusion engine online — all feeds active");
    addLog("flight", `ADS-B: ${f.length} tracks ingested`);
    addLog("ship", `AIS: ${s.length} vessels tracked`);
    addLog("satellite", `Space tracking: ${sat.length} objects indexed`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── System clock ─────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setSystemTime(formatUTCTime(new Date()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Live Mode: animate data ──────────────────────────────────────────────
  const startLiveMode = useCallback(() => {
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);

    liveIntervalRef.current = setInterval(() => {
      const dt = 0.002 / 60; // 2s / 1hr (flight crosses world in ~1hr)

      // Animate flights
      setFlights((prev) => {
        const next = prev.map((f) => {
          let prog = f.progress + dt * (f.speed / 800);
          if (prog >= 1) prog = 0; // loop
          const target = f.diverted && f.divertTarget ? f.divertTarget : f.destination;
          const [lat, lon] = interpolatePath(f.origin, target, prog);
          const hdg = bearing([f.lat, f.lon], [lat, lon]);
          return { ...f, lat, lon, heading: hdg, progress: prog };
        });
        flightsRef.current = next;
        return next;
      });

      // Animate ships (much slower)
      setShips((prev) => {
        const next = prev.map((s) => {
          const dtShip = 0.00002 * s.speed;
          const latDelta = Math.cos((s.heading * Math.PI) / 180) * dtShip;
          const lonDelta = Math.sin((s.heading * Math.PI) / 180) * dtShip;
          let lat = s.lat + latDelta;
          let lon = s.lon + lonDelta;
          // Bounce heading if out of Gulf region
          let heading = s.heading;
          if (lat > 30 || lat < 12 || lon > 70 || lon < 40) {
            heading = (heading + 180) % 360;
            lat = Math.max(13, Math.min(29, lat));
            lon = Math.max(41, Math.min(69, lon));
          }
          return { ...s, lat, lon, heading };
        });
        shipsRef.current = next;
        return next;
      });

      // Animate satellites
      setSatellites((prev) => {
        const next = prev.map((sat, i) => {
          const dt_sat = 1 / (sat.period * 60); // progress per second / 2s interval
          const t = (sat.t + dt_sat * 2) % 1;
          const [lat, lon] = satPosition(sat, t);
          return { ...sat, lat, lon, t };
        });
        satsRef.current = next;
        return next;
      });

      // Randomly vary GPS jamming intensity
      setGpsZones((prev) => prev.map((z) => ({
        ...z,
        intensity: Math.max(0.1, Math.min(1, z.intensity + (Math.random() - 0.5) * 0.05)),
      })));

    }, 2000);

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  }, []);

  // ─── AI Agent message stream ─────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "live") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let idx = 0;

    const scheduleNext = () => {
      if (idx >= AI_AGENT_MESSAGES.length) {
        // Loop
        idx = 0;
        setTimeout(scheduleNext, 5000);
        return;
      }
      const { delay, msg, type } = AI_AGENT_MESSAGES[idx];
      const timer = setTimeout(() => {
        setAiMessages((prev) => [
          ...prev.slice(-12), // keep last 12
          { id: generateId(), text: msg, type },
        ]);
        idx++;
        scheduleNext();
      }, delay);
      timers.push(timer);
    };
    scheduleNext();

    return () => timers.forEach(clearTimeout);
  }, [mode]);

  // ─── Mode switching ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "live") {
      // Clear playback state
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
      setIsPlaying(false);

      // Reset events
      setEvents(PLAYBACK_EVENTS.map(e => ({ ...e, active: false })));
      setNoFlyZones(NO_FLY_ZONES.map(z => ({ ...z })));

      // Start live animation
      startLiveMode();

      setThreatLevel("YELLOW");
      addLog("system", "Switched to LIVE MODE — real-time feed active");
    } else {
      // Stop live animation
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);

      setPlaybackTime(0);
      triggeredEventsRef.current = new Set();
      setEvents(PLAYBACK_EVENTS.map(e => ({ ...e, active: false })));
      setNoFlyZones(NO_FLY_ZONES.map(z => ({
        ...z,
        active: z.id === "nfz01" ? false : z.active,
      })));
      setThreatLevel("GREEN");
      addLog("system", "Switched to PLAYBACK MODE — Operation Epic Fury loaded");
      addLog("ai", "Pre-conflict baseline established. T0 ready.");
    }

    return () => {
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ─── Playback engine ──────────────────────────────────────────────────────
  useEffect(() => {
    playbackRef.current = { time: playbackTime, playing: isPlaying, speed: playbackSpeed };
  }, [playbackTime, isPlaying, playbackSpeed]);

  useEffect(() => {
    if (mode !== "playback") return;
    if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    if (!isPlaying) return;

    playbackIntervalRef.current = setInterval(() => {
      setPlaybackTime((prev) => {
        const next = prev + (playbackRef.current.speed * 0.1); // speed * 100ms
        if (next >= 120) {
          setIsPlaying(false);
          return 120;
        }
        return next;
      });
    }, 100);

    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [isPlaying, mode]);

  // ─── Playback event triggering ────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "playback") return;
    const t = playbackTime;

    PLAYBACK_EVENTS.forEach((evt) => {
      if (t >= evt.timestamp && !triggeredEventsRef.current.has(evt.id)) {
        triggeredEventsRef.current.add(evt.id);
        triggerPlaybackEvent(evt);
      }
    });

    // Animate flight positions in playback (simpler)
    const baseFlights = [...COMMERCIAL_FLIGHT_DEFS, ...MILITARY_FLIGHT_DEFS].map((def) => {
      const baseProg = 0.1 + (def.id.charCodeAt(1) / 200);
      const prog = (baseProg + t * 0.001) % 1;
      const isDiverted = ["f16","f17","f18","f19","f20"].includes(def.id) && t >= 30;
      const target = isDiverted
        ? [20.0, 63.0] as [number, number]
        : def.destination;
      const [lat, lon] = interpolatePath(def.origin, target, prog);
      const hdg = bearing(def.origin, target);
      return { ...def, lat, lon, heading: hdg, progress: prog, diverted: isDiverted };
    });
    setFlights(baseFlights as FlightTrack[]);

    // Satellite animation during playback
    setSatellites((prev) => prev.map((sat) => {
      const phase = (sat.t + t * 0.001) % 1;
      const [lat, lon] = satPosition(sat, phase);
      const overpassActive = (sat.type === "spy" && (Math.abs(t - 5) < 10 || Math.abs(t - 65) < 10));
      return { ...sat, lat, lon, t: phase, overpassActive };
    }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbackTime, mode]);

  function triggerPlaybackEvent(evt: EventMarker) {
    setEvents((prev) =>
      prev.map((e) => e.id === evt.id ? { ...e, active: true } : e)
    );

    const severityIcon = evt.severity === "critical" ? "🔴" : evt.severity === "high" ? "🟠" : "🟡";
    const logType = evt.type === "strike" ? "strike" : evt.type === "declaration" ? "nfz" :
      evt.type === "diversion" ? "flight" : evt.type === "closure" ? "strike" : "ai";
    addLog(logType, `${severityIcon} ${evt.title}: ${evt.description.substring(0, 80)}...`);

    // Side effects
    if (evt.id === "ev02") {
      // Iran NFZ activated
      setNoFlyZones((prev) => prev.map((z) =>
        z.id === "nfz01" ? { ...z, active: true } : z
      ));
      setThreatLevel("ORANGE");
      addLog("nfz", "NOTAM issued: Iran airspace CLOSED to all civilian traffic");
    }
    if (evt.id === "ev04") {
      // GPS jamming intensifies
      setGpsZones([
        { id: "j01", center: [36.0, 36.2], radiusKm: 150, intensity: 0.8 },
        { id: "j02", center: [32.5, 35.5], radiusKm: 80, intensity: 0.7 },
        { id: "j03", center: [55.75, 37.6], radiusKm: 200, intensity: 0.4 },
        { id: "j04", center: [32.0, 50.0], radiusKm: 300, intensity: 0.9 },
        { id: "j05", center: [27.5, 56.5], radiusKm: 200, intensity: 0.75 },
        { id: "j06", center: [25.2, 51.6], radiusKm: 120, intensity: 0.85 },
      ]);
      addLog("gps", "GPS constellation integrity DEGRADED over Persian Gulf — PNT unreliable");
    }
    if (evt.id === "ev05") {
      setThreatLevel("RED");
      addLog("ai", "THREAT LEVEL CRITICAL — Retaliatory attack confirmed. Force protection: DELTA");
    }
    if (evt.id === "ev06") {
      setThreatLevel("RED");
      addLog("ship", "Strait of Hormuz CLOSED — 6th Fleet ordered to intercept position");
    }
  }

  // ─── Log helper ───────────────────────────────────────────────────────────
  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    const entry: LogEntry = {
      id: generateId(),
      time: formatLogTime(new Date()),
      message,
      type,
    };
    setLogEntries((prev) => [...prev.slice(-100), entry]);
  }, []);

  // ─── Layer toggle ─────────────────────────────────────────────────────────
  const handleLayerToggle = (key: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Header bar top stats ────────────────────────────────────────────────
  const topStats = [
    { label: "TRACKS", val: flights.length, color: "#4488ff" },
    { label: "VESSELS", val: ships.length, color: "#ffd700" },
    { label: "SATELLITES", val: satellites.length, color: "#00ff9d" },
    { label: "JAM ZONES", val: gpsZones.length, color: "#ff3366" },
    { label: "NFZ ACTIVE", val: noFlyZones.filter(z => z.active).length, color: "#ff8c00" },
  ];

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-dark)" }}>

      {/* ── TOP HEADER ── */}
      <header className="glass-panel-bright border-b flex items-center justify-between" style={{
        borderColor: "var(--border-bright)",
        padding: "0 16px",
        height: "48px",
        flexShrink: 0,
        zIndex: 10,
      }}>
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div style={{
            width: "32px", height: "32px",
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, rgba(0,212,255,0.3), rgba(0,50,100,0.8))",
            border: "1px solid var(--accent-cyan)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px",
            boxShadow: "0 0 12px rgba(0,212,255,0.3)",
          }}>
            🌐
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: "15px", fontWeight: 700, color: "var(--accent-cyan)", letterSpacing: "0.2em" }}>
              WORLDVIEW
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "8px", color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              4D OSINT COMMAND CENTER v1.0
            </div>
          </div>
        </div>

        {/* Top Stats */}
        <div className="flex items-center gap-6">
          {topStats.map(({ label, val, color }) => (
            <div key={label} className="flex flex-col items-center">
              <span style={{ fontFamily: "var(--font-display)", fontSize: "14px", color, fontWeight: 600 }}>{val}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "7px", color: "var(--text-dim)", letterSpacing: "0.08em" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Mode badge + time */}
        <div className="flex items-center gap-4">
          <div style={{
            padding: "4px 10px",
            background: mode === "live" ? "rgba(0, 255, 157, 0.1)" : "rgba(0, 212, 255, 0.1)",
            border: `1px solid ${mode === "live" ? "var(--accent-green)" : "var(--accent-cyan)"}`,
            borderRadius: "3px",
            fontFamily: "var(--font-display)",
            fontSize: "9px",
            color: mode === "live" ? "var(--accent-green)" : "var(--accent-cyan)",
            letterSpacing: "0.1em",
            display: "flex", alignItems: "center", gap: "5px",
          }}>
            {mode === "live" && <span className="status-dot live" style={{ width: "6px", height: "6px" }} />}
            {mode === "live" ? "LIVE FEED" : "PLAYBACK MODE"}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-secondary)", letterSpacing: "0.08em" }}>
            {systemTime}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left Sidebar */}
        <Sidebar
          mode={mode}
          onModeChange={setMode}
          layers={layers}
          onLayerToggle={handleLayerToggle}
          satellites={satellites}
          gpsZones={gpsZones}
          systemTime={systemTime}
          threatLevel={threatLevel}
        />

        {/* Center: Globe + Controls */}
        <div className="flex flex-col flex-1 overflow-hidden" style={{ position: "relative" }}>

          {/* Globe */}
          <div style={{ flex: 1, position: "relative" }}>
            {cesiumReady && (
              <CesiumGlobe
                flights={flights}
                ships={ships}
                satellites={satellites}
                gpsZones={gpsZones}
                noFlyZones={noFlyZones}
                events={events}
                layers={layers}
                onTooltip={setTooltip}
                onEntityClick={(type, id) => {
                  addLog("ai", `Entity selected: [${type.toUpperCase()}] ${id}`);
                }}
              />
            )}

            {/* Cesium loading overlay */}
            {!cesiumReady && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: "20px",
                background: "var(--bg-dark)",
              }}>
                <div style={{
                  width: "80px", height: "80px", borderRadius: "50%",
                  border: "2px solid var(--border-bright)",
                  borderTop: "2px solid var(--accent-cyan)",
                  animation: "radar-sweep 1s linear infinite",
                }} />
                <div style={{
                  fontFamily: "var(--font-display)", fontSize: "14px",
                  color: "var(--accent-cyan)", letterSpacing: "0.2em",
                }}>
                  LOADING CESIUM GLOBE...
                </div>
              </div>
            )}

            {/* Corner decorations */}
            <div style={{
              position: "absolute", top: "12px", left: "12px",
              pointerEvents: "none", zIndex: 2,
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "9px",
                color: "var(--accent-cyan)", opacity: 0.6,
                lineHeight: 1.8,
              }}>
                <div>LAT: {flights[0]?.lat.toFixed(4) || "—"}°N</div>
                <div>LON: {flights[0]?.lon.toFixed(4) || "—"}°E</div>
                <div>ALT: {(flights[0]?.altitude || 0).toLocaleString()} FT</div>
              </div>
            </div>

            {/* Scan line effect */}
            <div style={{
              position: "absolute", inset: 0,
              background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.015) 2px, rgba(0,212,255,0.015) 4px)",
              pointerEvents: "none", zIndex: 1,
            }} />
          </div>

          {/* Playback controls (only in playback mode) */}
          {mode === "playback" && (
            <PlaybackControls
              currentTime={playbackTime}
              isPlaying={isPlaying}
              onTimeChange={(t) => {
                setPlaybackTime(t);
                // Reset and re-trigger events up to new time
                triggeredEventsRef.current = new Set();
                PLAYBACK_EVENTS.forEach((evt) => {
                  if (evt.timestamp < t) {
                    triggeredEventsRef.current.add(evt.id);
                  }
                });
                setEvents(PLAYBACK_EVENTS.map(e => ({
                  ...e,
                  active: e.timestamp <= t,
                })));
              }}
              onPlayPause={() => setIsPlaying(p => !p)}
              onReset={() => {
                setPlaybackTime(0);
                setIsPlaying(false);
                triggeredEventsRef.current = new Set();
                setEvents(PLAYBACK_EVENTS.map(e => ({ ...e, active: false })));
                setNoFlyZones(NO_FLY_ZONES.map(z => ({
                  ...z,
                  active: z.id === "nfz01" ? false : z.active,
                })));
                setGpsZones(GPS_JAM_ZONES_INITIAL);
                setThreatLevel("GREEN");
                addLog("system", "Playback reset to T0");
              }}
              playbackSpeed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
            />
          )}

          {/* Event Log */}
          <EventLog entries={logEntries} mode={mode} />
        </div>

        {/* Right: AI Agent Panel */}
        <AIAgentPanel messages={aiMessages} mode={mode} />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <Tooltip
          x={tooltip.x}
          y={tooltip.y}
          title={tooltip.title}
          rows={tooltip.rows}
        />
      )}
    </div>
  );
}
