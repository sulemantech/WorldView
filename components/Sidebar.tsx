"use client";
// ============================================================
// WORLDVIEW — Sidebar Component
// Layer controls, mode selection, status indicators
// ============================================================

import { useState } from "react";
import type { LayerVisibility, AppMode } from "@/lib/cesiumHelpers";
import type { Satellite, GpsJamZone } from "@/lib/dataGenerators";

interface SidebarProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  layers: LayerVisibility;
  onLayerToggle: (key: keyof LayerVisibility) => void;
  satellites: Satellite[];
  gpsZones: GpsJamZone[];
  systemTime: string;
  threatLevel: "GREEN" | "YELLOW" | "ORANGE" | "RED";
  isOpen: boolean;
  onClose: () => void;
}

const LAYER_GROUPS: {
  id: string;
  label: string;
  icon: string;
  color: string;
  layers: { key: keyof LayerVisibility; label: string; icon: string; color: string }[];
}[] = [
  {
    id: "aircraft", label: "AIRCRAFT", icon: "✈", color: "#4488ff",
    layers: [
      { key: "commercialFlights", label: "Commercial", icon: "✈", color: "#4488ff" },
      { key: "militaryFlights",   label: "Military",   icon: "🔴", color: "#ff3366" },
    ],
  },
  {
    id: "maritime", label: "MARITIME", icon: "⚓", color: "#ffd700",
    layers: [
      { key: "ships", label: "Vessels", icon: "⛵", color: "#ffd700" },
    ],
  },
  {
    id: "space", label: "SPACE", icon: "🛰", color: "#00ff9d",
    layers: [
      { key: "satellites", label: "Satellites", icon: "🛰", color: "#00ff9d" },
    ],
  },
  {
    id: "threats", label: "THREATS", icon: "⚠", color: "#ff3366",
    layers: [
      { key: "gpsJamming",  label: "GPS Jamming",   icon: "📡", color: "#ff3366" },
      { key: "noFlyZones",  label: "No-Fly Zones",  icon: "🚫", color: "#ff8c00" },
    ],
  },
  {
    id: "events", label: "EVENTS", icon: "⚡", color: "#ffd700",
    layers: [
      { key: "events", label: "Event Markers", icon: "⚡", color: "#ffd700" },
    ],
  },
  {
    id: "map", label: "MAP OVERLAYS", icon: "🗺", color: "#00d4ff",
    layers: [
      { key: "countryBoundaries", label: "Boundaries",    icon: "🗺", color: "#00d4ff" },
      { key: "countryLabels",     label: "Country Names", icon: "🏷", color: "#7ab8d4" },
    ],
  },
];

const THREAT_COLORS = {
  GREEN: "#00ff9d",
  YELLOW: "#ffd700",
  ORANGE: "#ff8c00",
  RED: "#ff3366",
};

export default function Sidebar({
  mode, onModeChange, layers, onLayerToggle,
  satellites, gpsZones, systemTime, threatLevel, isOpen, onClose,
}: SidebarProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(LAYER_GROUPS.map(g => g.id))
  );

  const toggleGroup = (id: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const avgJam = gpsZones.length > 0
    ? gpsZones.reduce((s, z) => s + z.intensity, 0) / gpsZones.length
    : 0;

  const activeSats = satellites.filter(s => s.overpassActive);

  return (
    <>
      {/* Mobile scrim — click to close */}
      <div className={`sidebar-scrim${isOpen ? " open" : ""}`} onClick={onClose} />

      <div className={`glass-panel-bright flex flex-col h-full overflow-hidden sidebar-panel${isOpen ? " open" : ""}`}
        style={{ width: "260px", flexShrink: 0 }}>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="sidebar-hamburger"
          style={{
            position: "absolute", top: "10px", right: "10px",
            background: "transparent", border: "none",
            color: "var(--accent-cyan)", fontSize: "18px", cursor: "pointer",
            display: "none",
          }}
          aria-label="Close menu"
        >✕</button>

        {/* Header */}
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="status-dot live" />
            <span style={{ fontFamily: "var(--font-display)", fontSize: "11px", color: "var(--accent-cyan)", letterSpacing: "0.1em" }}>
              SYSTEM ONLINE
            </span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)" }}>
            {systemTime} UTC
          </div>
        </div>

        {/* Threat Level */}
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: "9px", color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: "6px" }}>
            THREAT ASSESSMENT
          </div>
          <div style={{
            width: "100%", height: "24px",
            background: `linear-gradient(90deg, ${THREAT_COLORS[threatLevel]}33, ${THREAT_COLORS[threatLevel]}66)`,
            border: `1px solid ${THREAT_COLORS[threatLevel]}`,
            borderRadius: "3px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-display)",
            fontSize: "11px",
            color: THREAT_COLORS[threatLevel],
            boxShadow: `0 0 10px ${THREAT_COLORS[threatLevel]}40`,
            letterSpacing: "0.15em",
          }}>
            {threatLevel} ALERT
          </div>
        </div>

        {/* Mode Selector */}
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: "9px", color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: "8px" }}>
            OPERATION MODE
          </div>
          <div className="flex gap-1">
            {(["live", "playback"] as AppMode[]).map((m) => (
              <button
                key={m}
                onClick={() => onModeChange(m)}
                style={{
                  flex: 1,
                  padding: "7px",
                  fontSize: "9px",
                  letterSpacing: "0.1em",
                  fontFamily: "var(--font-display)",
                  background: mode === m
                    ? (m === "live" ? "rgba(0, 255, 157, 0.15)" : "rgba(0, 212, 255, 0.15)")
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${mode === m
                    ? (m === "live" ? "var(--accent-green)" : "var(--accent-cyan)")
                    : "var(--border)"}`,
                  color: mode === m
                    ? (m === "live" ? "var(--accent-green)" : "var(--accent-cyan)")
                    : "var(--text-secondary)",
                  borderRadius: "3px",
                  cursor: "pointer",
                  textTransform: "uppercase",
                  transition: "all 0.2s",
                }}
              >
                {m === "live" ? "⬤ LIVE" : "⏵ PLAYBACK"}
              </button>
            ))}
          </div>
        </div>

        {/* Layer Toggles — grouped & collapsible */}
        <div className="p-3 border-b flex-1 overflow-y-auto" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: "9px", color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: "8px" }}>
            DATA LAYERS
          </div>
          <div className="flex flex-col" style={{ gap: "2px" }}>
            {LAYER_GROUPS.map((group) => {
              const activeCount = group.layers.filter(l => layers[l.key]).length;
              const isGroupOpen = openGroups.has(group.id);
              return (
                <div key={group.id}>
                  {/* Group header row */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "5px 4px",
                      background: isGroupOpen ? `${group.color}0d` : "transparent",
                      border: "none",
                      borderBottom: `1px solid ${isGroupOpen ? group.color + "28" : "var(--border)"}`,
                      cursor: "pointer",
                      borderRadius: "3px 3px 0 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px" }}>{group.icon}</span>
                      <span style={{
                        fontSize: "9px",
                        fontFamily: "var(--font-display)",
                        color: activeCount > 0 ? group.color : "var(--text-dim)",
                        letterSpacing: "0.1em",
                      }}>
                        {group.label}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <span style={{
                        fontSize: "8px",
                        fontFamily: "var(--font-mono)",
                        color: activeCount > 0 ? group.color + "bb" : "var(--text-dim)",
                      }}>
                        {activeCount}/{group.layers.length}
                      </span>
                      <span style={{
                        fontSize: "8px",
                        color: "var(--text-dim)",
                        display: "inline-block",
                        transform: isGroupOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                        lineHeight: 1,
                      }}>▼</span>
                    </div>
                  </button>

                  {/* Expanded layer list */}
                  {isGroupOpen && (
                    <div
                      className="flex flex-col"
                      style={{
                        gap: "6px",
                        padding: "6px 4px 8px 12px",
                        background: `${group.color}07`,
                        borderBottom: `1px solid ${group.color}1a`,
                        borderRadius: "0 0 3px 3px",
                        marginBottom: "2px",
                      }}
                    >
                      {group.layers.map(({ key, label, icon, color }) => (
                        <label key={key} className="toggle-checkbox" style={{ justifyContent: "space-between" }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: "11px" }}>{icon}</span>
                            <span style={{
                              fontSize: "10px",
                              color: layers[key] ? color : "var(--text-dim)",
                              fontFamily: "var(--font-mono)",
                              transition: "color 0.2s",
                            }}>
                              {label}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={layers[key]}
                            onChange={() => onLayerToggle(key)}
                          />
                          <span className="toggle-track" />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status Indicators */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div style={{ fontSize: "9px", color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: "8px" }}>
            SENSOR STATUS
          </div>
          <div className="flex flex-col gap-2">
            {/* GPS Jamming */}
            <div>
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                  GPS JAMMING
                </span>
                <span style={{ fontSize: "9px", color: avgJam > 0.5 ? "var(--accent-red)" : "var(--accent-orange)", fontFamily: "var(--font-mono)" }}>
                  {Math.round(avgJam * 100)}%
                </span>
              </div>
              <div style={{ height: "3px", background: "var(--border)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${avgJam * 100}%`,
                  background: "linear-gradient(90deg, #ff8c00, #ff3366)",
                  transition: "width 0.5s ease",
                  boxShadow: "0 0 6px #ff3366",
                }} />
              </div>
            </div>

            {/* Active Satellites */}
            <div className="flex justify-between">
              <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                SAT OVERPASSES
              </span>
              <span style={{
                fontSize: "9px",
                fontFamily: "var(--font-mono)",
                color: activeSats.length > 0 ? "var(--accent-green)" : "var(--text-dim)",
              }}>
                {activeSats.length > 0 ? `${activeSats.length} ACTIVE` : "NONE"}
              </span>
            </div>

            {/* ADS-B */}
            <div className="flex justify-between">
              <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                ADS-B FEED
              </span>
              <span style={{ fontSize: "9px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                ●&nbsp;LIVE
              </span>
            </div>

            {/* AIS */}
            <div className="flex justify-between">
              <span style={{ fontSize: "9px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                AIS FEED
              </span>
              <span style={{ fontSize: "9px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>
                ●&nbsp;LIVE
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
