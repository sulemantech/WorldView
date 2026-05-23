"use client";
// AI Agent sidebar panel

interface AIAgentPanelProps {
  messages: { id: string; text: string; type: string }[];
  mode: "live" | "playback";
}

const TYPE_ICONS: Record<string, string> = {
  ai: "🤖",
  satellite: "🛰",
  flight: "✈",
  ship: "⛵",
  gps: "📡",
  system: "⚙",
};

const TYPE_COLORS: Record<string, string> = {
  ai: "#00d4ff",
  satellite: "#00ff9d",
  flight: "#4488ff",
  ship: "#ffd700",
  gps: "#9b59ff",
  system: "#3d7a9e",
};

export default function AIAgentPanel({ messages, mode }: AIAgentPanelProps) {
  return (
    <div className="glass-panel-bright flex flex-col" style={{
      width: "240px",
      flexShrink: 0,
      borderLeft: "1px solid var(--border)",
    }}>
      {/* Header */}
      <div className="px-3 py-2 border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
        <div style={{
          width: "20px", height: "20px",
          borderRadius: "50%",
          background: "rgba(0, 212, 255, 0.1)",
          border: "1px solid var(--accent-cyan)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "10px",
          animation: mode === "live" ? "radar-sweep 3s linear infinite" : "none",
        }}>
          ◎
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "9px", color: "var(--accent-cyan)", letterSpacing: "0.1em" }}>
            AI FUSION ENGINE
          </div>
          <div style={{ fontSize: "8px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
            {mode === "live" ? "ACTIVE ANALYSIS" : "REPLAY MODE"}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 border-b" style={{ borderColor: "var(--border)" }}>
        {[
          { label: "TRACKS", val: "1,247", color: "#4488ff" },
          { label: "VESSELS", val: "13", color: "#ffd700" },
          { label: "ALERTS", val: "7", color: "#ff3366" },
          { label: "SATS", val: "5", color: "#00ff9d" },
        ].map(({ label, val, color }) => (
          <div key={label} className="p-2 flex flex-col items-center" style={{ borderRight: "1px solid var(--border)", borderBottom: "0" }}>
            <span style={{ fontSize: "13px", fontFamily: "var(--font-display)", color, fontWeight: "bold" }}>{val}</span>
            <span style={{ fontSize: "7px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Agent messages */}
      <div className="flex-1 overflow-y-auto p-2" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {messages.map((msg) => (
          <div key={msg.id} className="fade-in-up" style={{
            padding: "5px 6px",
            background: `${TYPE_COLORS[msg.type] || "#00d4ff"}08`,
            border: `1px solid ${TYPE_COLORS[msg.type] || "#00d4ff"}22`,
            borderRadius: "3px",
            display: "flex",
            gap: "5px",
            alignItems: "flex-start",
          }}>
            <span style={{ fontSize: "11px", flexShrink: 0 }}>
              {TYPE_ICONS[msg.type] || "●"}
            </span>
            <span style={{
              fontSize: "9px",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-mono)",
              lineHeight: "1.5",
            }}>
              {msg.text}
            </span>
          </div>
        ))}
        {mode === "live" && (
          <div style={{ padding: "4px 6px", display: "flex", gap: "4px", alignItems: "center" }}>
            <span className="blink" style={{ color: "var(--accent-cyan)", fontSize: "12px" }}>▊</span>
            <span style={{ fontSize: "9px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>analyzing...</span>
          </div>
        )}
      </div>

      {/* Ticker */}
      <div className="border-t p-2 ticker-wrap" style={{ borderColor: "var(--border)" }}>
        <div className="ticker-content" style={{ fontSize: "8px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          SIGINT ACTIVE &nbsp;•&nbsp; ELINT PASSIVE &nbsp;•&nbsp; HUMINT CORRELATED &nbsp;•&nbsp;
          GEOINT PROCESSED &nbsp;•&nbsp; MASINT ONLINE &nbsp;•&nbsp; OSINT FUSION ACTIVE &nbsp;•&nbsp;
          SIGINT ACTIVE &nbsp;•&nbsp; ELINT PASSIVE &nbsp;•&nbsp; HUMINT CORRELATED &nbsp;•&nbsp;
          GEOINT PROCESSED &nbsp;•&nbsp; MASINT ONLINE &nbsp;•&nbsp; OSINT FUSION ACTIVE
        </div>
      </div>
    </div>
  );
}
