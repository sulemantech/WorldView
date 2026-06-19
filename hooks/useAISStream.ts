"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Ship } from "@/lib/dataGenerators";

// Persian Gulf / Indian Ocean bounding box — AISstream format: [[lat, lon], [lat, lon]]
const GULF_BOX: [[number, number], [number, number]] = [
  [12.0, 40.0],
  [30.0, 70.0],
];

function toShipType(aisTypeCode: number): Ship["type"] {
  if (aisTypeCode >= 80 && aisTypeCode <= 89) return "tanker";
  if (aisTypeCode === 35 || aisTypeCode === 36) return "warship";
  return "cargo";
}

const TYPE_COLOR: Record<Ship["type"], string> = {
  tanker:  "#ffd700",
  cargo:   "#00aaff",
  warship: "#ff4444",
  carrier: "#ff8c00",
};

interface AISMsg {
  MessageType: string;
  Metadata: {
    Latitude: number;
    Longitude: number;
    ShipName: string;
    MMSI: number;
  };
  Message: {
    PositionReport?: { TrueHeading: number; Sog: number; Cog: number };
    ShipStaticData?: { Type: number };
  };
}

export function useAISStream(enabled: boolean): { ships: Ship[]; connected: boolean } {
  const [ships, setShips] = useState<Ship[]>([]);
  const [connected, setConnected] = useState(false);
  const vessels = useRef<Map<string, Ship>>(new Map());
  const aisTypes = useRef<Map<string, number>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    const key = process.env.NEXT_PUBLIC_AISSTREAM_API_KEY;
    if (!key) return;

    try {
      const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");
      wsRef.current = socket;

      socket.onopen = () => {
        setConnected(true);
        socket.send(
          JSON.stringify({
            APIKey: key,
            BoundingBoxes: [GULF_BOX],
            FilterMessageTypes: ["PositionReport", "ShipStaticData"],
          })
        );
      };

      socket.onmessage = (evt) => {
        try {
          const msg: AISMsg = JSON.parse(evt.data as string);
          const mmsi = String(msg.Metadata.MMSI);

          if (msg.MessageType === "ShipStaticData" && msg.Message.ShipStaticData) {
            aisTypes.current.set(mmsi, msg.Message.ShipStaticData.Type);
            return;
          }

          if (msg.MessageType === "PositionReport" && msg.Message.PositionReport) {
            const pr = msg.Message.PositionReport;
            const type = toShipType(aisTypes.current.get(mmsi) ?? 0);
            const hdg =
              pr.TrueHeading >= 0 && pr.TrueHeading < 360 ? pr.TrueHeading : pr.Cog;

            vessels.current.set(mmsi, {
              id: mmsi,
              name: msg.Metadata.ShipName.trim() || mmsi,
              type,
              lat: msg.Metadata.Latitude,
              lon: msg.Metadata.Longitude,
              heading: Math.round(hdg),
              speed: pr.Sog,
              flag: "🌊",
              color: TYPE_COLOR[type],
            });
          }
        } catch {
          /* ignore parse errors */
        }
      };

      socket.onclose = () => {
        setConnected(false);
        // Auto-reconnect after 5s if still enabled
        if (enabled) {
          retryTimer.current = setTimeout(connect, 5000);
        }
      };

      socket.onerror = () => socket.close();
    } catch {
      /* WebSocket unavailable (SSR guard) */
    }
  }, [enabled]);

  // Flush vessel map → React state every 2 seconds (matches live animation interval)
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      const list = Array.from(vessels.current.values());
      if (list.length > 0) setShips(list.slice(0, 60));
    }, 2000);
    return () => clearInterval(t);
  }, [enabled]);

  // Connect / disconnect lifecycle
  useEffect(() => {
    if (!enabled) {
      wsRef.current?.close();
      vessels.current.clear();
      setShips([]);
      setConnected(false);
      return;
    }
    connect();
    return () => {
      wsRef.current?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [enabled, connect]);

  return { ships, connected };
}
