"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { FlightTrack } from "@/lib/dataGenerators";

// Middle East / Gulf / broader region bounding box
const BOUNDS = "lamin=5&lomin=20&lamax=55&lomax=90";

// OpenSky state vector: 17-element array (see https://opensky-network.org/api/states/all)
type StateVector = [
  string,          // 0  icao24
  string | null,   // 1  callsign
  string,          // 2  origin_country
  number | null,   // 3  time_position
  number,          // 4  last_contact
  number | null,   // 5  longitude
  number | null,   // 6  latitude
  number | null,   // 7  baro_altitude (metres)
  boolean,         // 8  on_ground
  number | null,   // 9  velocity (m/s)
  number | null,   // 10 true_track (degrees, clockwise from north)
  number | null,   // 11 vertical_rate (m/s)
  unknown,         // 12 sensors
  number | null,   // 13 geo_altitude (metres)
  string | null,   // 14 squawk
  boolean,         // 15 spi
  number,          // 16 position_source
];

// Known military callsign prefixes (best-effort; OpenSky has no type field)
const MILITARY_PREFIXES = [
  "RCH", "RRR", "USAF", "JAKE", "DUKE", "SLAM", "VIPER",
  "GHOST", "VALOR", "REACH", "IRON", "BLADE",
];

function classifyType(callsign: string): "commercial" | "military" {
  const cs = callsign.toUpperCase();
  return MILITARY_PREFIXES.some(p => cs.startsWith(p)) ? "military" : "commercial";
}

function toFlightTrack(sv: StateVector): FlightTrack | null {
  const icao24 = sv[0];
  const rawCallsign = sv[1];
  const lon = sv[5];
  const lat = sv[6];
  const altM = sv[7];
  const onGround = sv[8];
  const velMs = sv[9];
  const track = sv[10];

  // Skip on-ground aircraft or those with missing position
  if (onGround || lat == null || lon == null) return null;

  const callsign = (rawCallsign?.trim() || icao24).toUpperCase();
  const type = classifyType(callsign);
  const altFt = altM != null ? Math.round(altM * 3.281) : 35000;
  const speedKts = velMs != null ? Math.round(velMs * 1.944) : 450;
  const heading = track ?? 0;

  return {
    id: icao24,
    callsign,
    type,
    // origin/destination set to current position — not used when real data drives the map
    origin: [lat, lon],
    destination: [lat, lon],
    altitude: altFt,
    speed: speedKts,
    heading,
    lat,
    lon,
    progress: 0,
    color: type === "military" ? "#ff3366" : "#4488ff",
  };
}

const POLL_INTERVAL = 10_000; // OpenSky anonymous rate limit: 1 request per 10 s

export function useOpenSkyFlights(enabled: boolean): {
  flights: FlightTrack[];
  loading: boolean;
  lastUpdated: number | null;
} {
  const [flights, setFlights] = useState<FlightTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchFlights = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://opensky-network.org/api/states/all?${BOUNDS}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as { time: number; states: StateVector[] | null };
      if (!mountedRef.current) return;

      const tracks = (data.states ?? [])
        .map(toFlightTrack)
        .filter((f): f is FlightTrack => f !== null);

      setFlights(tracks);
      setLastUpdated(data.time);
    } catch {
      // network error / rate-limited — keep previous state, retry normally
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        if (enabled) {
          timerRef.current = setTimeout(fetchFlights, POLL_INTERVAL);
        }
      }
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setFlights([]);
      setLastUpdated(null);
      return;
    }
    fetchFlights();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, fetchFlights]);

  return { flights, loading, lastUpdated };
}
