"use client";

import { useEffect, useMemo, useState } from "react";
import { projectStandings, type WhatIfEntry, type ProjectedRow } from "@/lib/pool/whatif";
import type { Results } from "@/lib/scoring/types";
import type { ScoringConfig } from "@/lib/scoring/score";

interface PicksPayload {
  entries: WhatIfEntry[];
  results: Results;
  scoringConfig: ScoringConfig;
}

type Side = "home" | "away";

// Client-side "if they win" projection. Pulls every entry's picks once (members
// only), then re-scores standings in-browser via the pure engine for whichever
// side the viewer toggles — no server round-trip per toggle.
export function WhatIf({
  poolId,
  matchNo,
  homeCode,
  awayCode,
  homeName,
  awayName,
}: {
  poolId: string;
  matchNo: number;
  homeCode: string;
  awayCode: string;
  homeName: string;
  awayName: string;
}) {
  const [data, setData] = useState<PicksPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<Side>("home");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/pool/${poolId}/picks`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to load picks");
        return json.data as PicksPayload;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load picks");
      });
    return () => {
      cancelled = true;
    };
  }, [poolId]);

  const winnerCode = side === "home" ? homeCode : awayCode;

  const rows: ProjectedRow[] = useMemo(() => {
    if (!data) return [];
    return projectStandings(data.entries, data.results, { matchNo, winnerCode }, data.scoringConfig);
  }, [data, matchNo, winnerCode]);

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">What if…</p>

      <div
        role="group"
        aria-label="Choose the hypothetical winner"
        className="mt-3 grid grid-cols-2 gap-2"
      >
        {(["home", "away"] as const).map((s) => {
          const active = side === s;
          const name = s === "home" ? homeName : awayName;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={active}
              className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch ${
                active
                  ? "border-pitch bg-pitch text-white"
                  : "border-line bg-surface text-ink-2 hover:bg-surface-sunk"
              }`}
            >
              {name} win
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="mt-3 text-sm text-ink-3">Couldn’t load the projection: {error}</p>
      ) : !data ? (
        <p className="mt-3 text-sm text-ink-3">Crunching the standings…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-3">No entries to project yet.</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map((row) => {
            const moved = row.rankDelta !== 0;
            const gained = row.delta > 0;
            return (
              <li
                key={row.entryId}
                className="flex items-center gap-3 rounded-lg bg-surface-sunk px-3 py-2 text-sm"
              >
                <span className="w-6 shrink-0 text-center font-mono tabular-nums text-ink-3">
                  {row.rank}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.label}</span>
                {moved ? (
                  <span
                    className="font-mono text-[11px] font-bold tabular-nums"
                    style={{ color: row.rankDelta > 0 ? "var(--positive)" : "var(--negative)" }}
                  >
                    {row.rankDelta > 0 ? "▲" : "▼"}
                    {Math.abs(row.rankDelta)}
                  </span>
                ) : null}
                {row.delta !== 0 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums text-white"
                    style={{ background: gained ? "var(--positive)" : "var(--negative)" }}
                  >
                    {gained ? "+" : ""}
                    {row.delta}
                  </span>
                ) : null}
                <span className="shrink-0 font-display tabular-nums text-ink">{row.total}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
