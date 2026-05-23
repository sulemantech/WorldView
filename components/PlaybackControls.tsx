"use client";
// ============================================================
// WORLDVIEW — Playback Controls
// Timeline slider, play/pause, event markers for Operation mode
// ============================================================

import { PLAYBACK_EVENTS } from "@/lib/dataGenerators";

interface PlaybackControlsProps {
  currentTime: number; // 0-120 minutes
  isPlaying: boolean;
  onTimeChange: (t: number) => void;
  onPlayPause: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onSpeedChange: (s: number) => void;
}

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes % 1) * 60);
  return `${h > 0 ? h + "h " : ""}${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

const EVENT_COLORS = {
  strike: "#ff3366",
  explosion: "#ff8c00",
  declaration: "#ff8c00",
  diversion: "#4488ff",
  closure: "#ff3366",
};

export default function PlaybackControls({
  currentTime, isPlaying, onTimeChange, onPlayPause, onReset,
  playbackSpeed, onSpeedChange,
}: PlaybackControlsProps) {
  const progress = (currentTime / 120) * 100;

  return (
    <div className="glass-panel-bright border-t" style={{ borderColor: "var(--border-bright)", padding: "12px 16px" }}>
      {/* Operation label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "10px",
            color: "var(--accent-red)",
            letterSpacing: "0.12em",
          }}>
            ⬡ OPERATION EPIC FURY
          </span>
          <span style={{
            fontSize: "9px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-dim)",
          }}>
            T+{formatTime(currentTime)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: "9px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>SPEED:</span>
          {[1, 5, 15, 30].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              style={{
                padding: "2px 6px",
                fontSize: "9px",
                fontFamily: "var(--font-mono)",
                background: playbackSpeed === s ? "rgba(0, 212, 255, 0.2)" : "transparent",
                border: `1px solid ${playbackSpeed === s ? "var(--accent-cyan)" : "var(--border)"}`,
                color: playbackSpeed === s ? "var(--accent-cyan)" : "var(--text-dim)",
                borderRadius: "2px",
                cursor: "pointer",
              }}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Timeline track with event markers */}
      <div style={{ position: "relative", marginBottom: "8px" }}>
        {/* Event markers above track */}
        <div style={{ position: "relative", height: "20px", marginBottom: "4px" }}>
          {PLAYBACK_EVENTS.map((evt) => {
            const pct = (evt.timestamp / 120) * 100;
            const color = EVENT_COLORS[evt.type as keyof typeof EVENT_COLORS] || "#ffd700";
            return (
              <div
                key={evt.id}
                title={`T+${evt.timestamp}min: ${evt.title}`}
                onClick={() => onTimeChange(evt.timestamp)}
                style={{
                  position: "absolute",
                  left: `${pct}%`,
                  top: 0,
                  transform: "translateX(-50%)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                }}
              >
                <div style={{
                  width: "2px",
                  height: "10px",
                  background: color,
                  boxShadow: `0 0 4px ${color}`,
                }} />
                <div style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: color,
                  boxShadow: `0 0 6px ${color}`,
                }} />
              </div>
            );
          })}
        </div>

        {/* Slider */}
        <input
          type="range"
          min={0}
          max={120}
          step={0.1}
          value={currentTime}
          onChange={(e) => onTimeChange(Number(e.target.value))}
          style={{
            width: "100%",
            "--progress": `${progress}%`,
          } as React.CSSProperties}
        />

        {/* Time labels */}
        <div className="flex justify-between mt-1">
          {[0, 15, 30, 45, 60, 75, 90, 105, 120].map((t) => (
            <span key={t} style={{
              fontSize: "8px",
              color: "var(--text-dim)",
              fontFamily: "var(--font-mono)",
            }}>
              {t === 0 ? "T0" : `+${t}`}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onReset}
          style={{
            padding: "5px 10px",
            fontSize: "9px",
            fontFamily: "var(--font-mono)",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            borderRadius: "3px",
            cursor: "pointer",
          }}
        >
          ⏮ RESET
        </button>
        <button
          onClick={onPlayPause}
          style={{
            padding: "5px 16px",
            fontSize: "10px",
            fontFamily: "var(--font-display)",
            background: isPlaying ? "rgba(255, 51, 102, 0.15)" : "rgba(0, 212, 255, 0.15)",
            border: `1px solid ${isPlaying ? "var(--accent-red)" : "var(--accent-cyan)"}`,
            color: isPlaying ? "var(--accent-red)" : "var(--accent-cyan)",
            borderRadius: "3px",
            cursor: "pointer",
            letterSpacing: "0.08em",
            boxShadow: isPlaying ? "0 0 8px rgba(255, 51, 102, 0.2)" : "0 0 8px rgba(0, 212, 255, 0.2)",
          }}
        >
          {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
        </button>

        {/* Active events */}
        <div className="flex gap-1 ml-2 flex-wrap">
          {PLAYBACK_EVENTS.filter(e => e.timestamp <= currentTime).map((evt) => {
            const color = EVENT_COLORS[evt.type as keyof typeof EVENT_COLORS] || "#ffd700";
            return (
              <span key={evt.id} style={{
                fontSize: "8px",
                padding: "2px 5px",
                background: `${color}15`,
                border: `1px solid ${color}60`,
                color,
                borderRadius: "2px",
                fontFamily: "var(--font-mono)",
                whiteSpace: "nowrap",
              }}>
                T+{evt.timestamp}m
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
