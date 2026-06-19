"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as sat from "satellite.js";
import type { Satellite } from "@/lib/dataGenerators";

const RAD2DEG = 180 / Math.PI;

// ─── Satellite classification ─────────────────────────────────────────────────

function classifyType(name: string): Satellite["type"] {
  const n = name.toUpperCase();
  if (
    n.startsWith("USA ") || n.includes("NROL") || n.includes("KH-") ||
    n.includes("ONYX") || n.includes("MISTY") || n.includes("ADVANCED KH")
  ) return "spy";
  if (
    n.startsWith("STARLINK") || n.startsWith("IRIDIUM") || n.startsWith("SES-") ||
    n.includes("INTELSAT") || n.includes("MUOS") || n.includes("AEHF") ||
    n.includes("WGS") || n.includes("MILSTAR") || n.includes("SKYNET")
  ) return "comms";
  return "commercial";
}

const TYPE_COLOR: Record<Satellite["type"], string> = {
  commercial: "#00ff9d",
  spy:        "#ff3366",
  comms:      "#9b59ff",
};

// ─── TLE parser ───────────────────────────────────────────────────────────────

interface ParsedTLE {
  name: string;
  satrec: sat.SatRec;
  type: Satellite["type"];
  period: number;      // minutes
  inclination: number; // degrees
}

function parseTLE(text: string): ParsedTLE[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const result: ParsedTLE[] = [];
  let i = 0;
  while (i < lines.length - 2) {
    const name = lines[i];
    const l1   = lines[i + 1];
    const l2   = lines[i + 2];
    if (l1.startsWith("1 ") && l2.startsWith("2 ")) {
      try {
        const satrec      = sat.twoline2satrec(l1, l2);
        const period      = (2 * Math.PI) / satrec.no; // minutes
        const inclination = satrec.inclo * RAD2DEG;
        result.push({ name, satrec, type: classifyType(name), period, inclination });
        i += 3;
        continue;
      } catch { /* malformed TLE — skip */ }
    }
    i++;
  }
  return result;
}

// ─── SGP4 propagation ─────────────────────────────────────────────────────────

// Gulf-area center for overpass detection
const GULF_LAT = 26;
const GULF_LON = 53;

function propagateNow(parsed: ParsedTLE[]): Satellite[] {
  const now  = new Date();
  const gmst = sat.gstime(now);
  const result: Satellite[] = [];

  for (const { name, satrec, type, period, inclination } of parsed) {
    const pv = sat.propagate(satrec, now);
    if (!pv || !pv.position || typeof pv.position !== "object") continue;

    const gd    = sat.eciToGeodetic(pv.position as sat.EciVec3<number>, gmst);
    const lat   = gd.latitude  * RAD2DEG;
    const lon   = gd.longitude * RAD2DEG;
    const altKm = gd.height;
    if (!isFinite(lat) || !isFinite(lon) || !isFinite(altKm)) continue;

    // Orbit phase 0-1 — approximated from minutes elapsed in current orbit
    const t = ((now.getTime() / 60_000) % period) / period;

    // Spy sats "activate" when passing within ~25° of the Gulf AOI
    const overpassActive =
      type === "spy" &&
      Math.abs(lat - GULF_LAT) < 25 &&
      Math.abs(lon - GULF_LON) < 35;

    result.push({
      id:          String(satrec.satnum),
      name,
      type,
      lat,
      lon,
      altitude:    Math.round(altKm),
      inclination,
      period,
      t,
      color:       TYPE_COLOR[type],
      overpassActive,
    });
  }
  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCelestrakSatellites(enabled: boolean): Satellite[] {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const parsedRef   = useRef<ParsedTLE[]>([]);
  const mountedRef  = useRef(true);
  const posTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const tleTimer    = useRef<ReturnType<typeof setTimeout>  | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchTLEs = useCallback(async () => {
    try {
      const res = await fetch("/api/celestrak");
      if (!res.ok) return;
      const text = await res.text();
      if (!mountedRef.current) return;
      parsedRef.current = parseTLE(text);
      setSatellites(propagateNow(parsedRef.current));
    } catch { /* keep simulated fallback */ }

    // Refresh TLE data every hour (they update a few times per day)
    if (mountedRef.current && enabled) {
      tleTimer.current = setTimeout(fetchTLEs, 3_600_000);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setSatellites([]);
      parsedRef.current = [];
      if (posTimer.current)  clearInterval(posTimer.current);
      if (tleTimer.current)  clearTimeout(tleTimer.current);
      return;
    }

    // Fetch TLEs immediately, then hourly
    fetchTLEs();

    // Recompute positions every 5 s from cached TLEs (no network needed)
    posTimer.current = setInterval(() => {
      if (parsedRef.current.length > 0) {
        setSatellites(propagateNow(parsedRef.current));
      }
    }, 5_000);

    return () => {
      if (posTimer.current)  clearInterval(posTimer.current);
      if (tleTimer.current)  clearTimeout(tleTimer.current);
    };
  }, [enabled, fetchTLEs]);

  return satellites;
}
