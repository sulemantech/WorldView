"use client";

interface TooltipProps {
  x: number;
  y: number;
  title: string;
  rows: [string, string][];
}

export default function Tooltip({ x, y, title, rows }: TooltipProps) {
  const adjustedX = Math.min(x + 12, window.innerWidth - 300);
  const adjustedY = Math.min(y - 10, window.innerHeight - 200);

  return (
    <div
      className="tooltip"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div style={{
        fontFamily: "var(--font-display)",
        fontSize: "11px",
        color: "var(--accent-cyan)",
        marginBottom: "8px",
        letterSpacing: "0.05em",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "6px",
      }}>
        {title}
      </div>
      {rows.map(([key, val], i) => (
        <div key={i} className="flex justify-between gap-4" style={{ marginBottom: "3px" }}>
          <span style={{ color: "var(--text-dim)", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
            {key}
          </span>
          <span style={{ color: "var(--text-primary)", fontSize: "10px", fontFamily: "var(--font-mono)", textAlign: "right" }}>
            {val}
          </span>
        </div>
      ))}
    </div>
  );
}
