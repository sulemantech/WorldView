"use client";
// ============================================================
// WORLDVIEW — Event Log Component
// Timestamped log panel for events + AI agent activity
// ============================================================

import { useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  time: string;
  message: string;
  type: "strike" | "nfz" | "satellite" | "flight" | "ship" | "gps" | "ai" | "system";
}

interface EventLogProps {
  entries: LogEntry[];
  mode: "live" | "playback";
}

const TYPE_LABELS: Record<string, string> = {
  strike: "STRIKE",
  nfz: "NFZ",
  satellite: "SAT",
  flight: "ADSB",
  ship: "AIS",
  gps: "GPS",
  ai: "OSINT",
  system: "SYS",
};

const TYPE_COLORS: Record<string, string> = {
  strike: "#ff3366",
  nfz: "#ff8c00",
  satellite: "#00ff9d",
  flight: "#4488ff",
  ship: "#ffd700",
  gps: "#9b59ff",
  ai: "#00d4ff",
  system: "#3d7a9e",
};

export default function EventLog({ entries, mode }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="glass-panel-bright flex flex-col" style={{
      height: "220px",
      borderTop: "1px solid var(--border)",
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)", flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-display)", fontSize: "10px", color: "var(--accent-cyan)", letterSpacing: "0.12em" }}>
            INTELLIGENCE LOG
          </span>
          {mode === "live" && (
            <div className="flex items-center gap-1">
              <div className="status-dot live" style={{ width: "5px", height: "5px" }} />
              <span style={{ fontSize: "8px", color: "var(--accent-green)", fontFamily: "var(--font-mono)" }}>STREAMING</span>
            </div>
          )}
        </div>
        <span style={{ fontSize: "9px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {entries.length} EVENTS
        </span>
      </div>

      {/* Log entries */}
      <div className="flex-1 overflow-y-auto px-2 py-2" style={{ gap: "3px", display: "flex", flexDirection: "column" }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={`log-entry ${entry.type} fade-in-up`}
            style={{
              display: "flex",
              gap: "8px",
              alignItems: "flex-start",
              padding: "3px 4px 3px 8px",
              borderLeftColor: TYPE_COLORS[entry.type],
            }}
          >
            <span style={{
              fontSize: "9px",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {entry.time}
            </span>
            <span style={{
              fontSize: "9px",
              padding: "0 4px",
              background: `${TYPE_COLORS[entry.type]}22`,
              color: TYPE_COLORS[entry.type],
              borderRadius: "2px",
              fontFamily: "var(--font-mono)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              {TYPE_LABELS[entry.type]}
            </span>
            <span style={{
              fontSize: "9px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              lineHeight: "1.4",
            }}>
              {entry.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
