"use client";

// Home-page group-stage view: the live group tables (same as GroupStandings) with
// the viewer's bracket picks overlaid — per-pick status markers and a per-group
// pill showing how the bracket's live provisional points are distributed across
// the groups. A dropdown switches brackets when the viewer owns more than one.

import { useState } from "react";
import Link from "next/link";
import type { BracketView } from "@/lib/pool/bracket-view";
import type { GroupTableRow } from "@/lib/pool/group-table";
import type { BracketOverlay } from "@/lib/pool/queries";
import type { GroupOverlayCell, PickStatus } from "@/lib/pool/group-overlay";
import { formatMatchDate } from "@/lib/pool/format";
import { TEAMS } from "@/lib/scoring/data";
import { Flag } from "./Flag";
import { GROUP_CITY, GroupLetterMark, FormChips } from "./group-bits";

type PredKind = PickStatus | "rest";

// Colour for a team in the viewer's predicted column, by outcome. exact = green
// (full points), the two partial cases = amber (they score the same), miss = red,
// pending/rest = grey. The points suffix makes the per-group pill self-explaining.
const PRED_STYLE: Record<PredKind, { cls: string; title: string }> = {
  exact: { cls: "font-bold text-pitch", title: "correct group position (1st/2nd)" },
  wrong_slot: { cls: "font-semibold text-gold-dark", title: "right team, wrong position — partial" },
  third: { cls: "font-semibold text-gold-dark", title: "advancing as a best-3rd team — partial" },
  miss: { cls: "text-red-500", title: "currently eliminated / out of the spots" },
  pending: { cls: "text-ink-3", title: "group not decided yet" },
  rest: { cls: "text-ink-4", title: "you didn't pick this team to go through" },
};

type PredEntry = { code: string | null; kind: PredKind; points: number };

// The viewer's predicted finishing order for a group, aligned to ranks 1..4: their
// 1st pick, their 2nd pick, then the two teams they left out (in current order).
function predictedOrder(cell: GroupOverlayCell | undefined, table: GroupTableRow[]): PredEntry[] {
  if (!cell) return [];
  const picks: PredEntry[] = [
    { code: cell.first.code, kind: cell.first.code ? cell.first.status : "rest", points: cell.first.points },
    { code: cell.second.code, kind: cell.second.code ? cell.second.status : "rest", points: cell.second.points },
  ];
  const picked = new Set([cell.first.code, cell.second.code].filter(Boolean));
  const rest: PredEntry[] = table
    .filter((r) => !picked.has(r.code))
    .map((r) => ({ code: r.code, kind: "rest", points: 0 }));
  return [...picks, ...rest];
}

// Small suffix shown after a predicted team: the points it earns, or ✗ when out.
function predSuffix(e: PredEntry): string {
  if (e.points > 0) return `+${e.points}`;
  if (e.kind === "miss") return "✗";
  return "";
}

function PointsPill({ cell }: { cell: GroupOverlayCell | undefined }) {
  if (!cell) return null;
  if (!cell.finalized && cell.liveDelta > 0) {
    return (
      <span
        className="ml-auto rounded-full border border-gold/40 bg-gold-tint px-2 py-0.5 text-[10px] font-bold tabular-nums text-gold-dark"
        title="Live group points from this group (still provisional)"
      >
        ⚡ +{cell.liveDelta}
      </span>
    );
  }
  if (cell.finalized && cell.officialPoints > 0) {
    return (
      <span
        className="ml-auto rounded-full bg-pitch-tint px-2 py-0.5 text-[10px] font-bold tabular-nums text-pitch-dark"
        title="Points locked in from this group"
      >
        {cell.officialPoints}
      </span>
    );
  }
  return null;
}

export function GroupOverlay({
  view,
  brackets,
  code,
}: {
  view: BracketView;
  brackets: BracketOverlay[];
  code: string;
}) {
  const [entryId, setEntryId] = useState(brackets[0].entryId);
  const selected = brackets.find((b) => b.entryId === entryId) ?? brackets[0];
  const cells = new Map<string, GroupOverlayCell>(selected.breakdown.groups.map((c) => [c.group, c]));
  const thirdPicks = new Set(selected.thirdAdvance);
  const total = selected.breakdown.totalLiveDelta;

  const anySet = view.groups.some((g) => g.table.length > 0) || view.thirds.length > 0;
  if (!anySet) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-center text-sm text-ink-3">
        Group standings will appear here once the group stage is decided.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 px-1">
        {brackets.length > 1 ? (
          <label className="flex items-center gap-1.5 text-xs text-ink-3">
            <span className="font-semibold">Overlay bracket</span>
            <select
              value={entryId}
              onChange={(e) => setEntryId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink"
            >
              {brackets.map((b) => (
                <option key={b.entryId} value={b.entryId}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="text-xs text-ink-3">
            Your picks: <span className="font-semibold text-ink">{selected.label}</span>
          </span>
        )}
        {total > 0 ? (
          <span className="ml-auto rounded-full border border-gold/40 bg-gold-tint px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-gold-dark">
            ⚡ +{total} live group pts
          </span>
        ) : null}
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-ink-4">
        <span className="font-semibold uppercase tracking-[0.06em] text-ink-3">Your call</span>
        <span><span className="font-bold text-pitch">+3</span> correct position</span>
        <span><span className="font-semibold text-gold-dark">+1</span> right team, wrong position</span>
        <span><span className="font-bold text-pitch">+3</span> best 3rd-place advancer</span>
        <span><span className="font-bold text-red-500">✗</span> eliminated</span>
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {view.groups.map((g) => {
          const city = GROUP_CITY[g.group] ?? "mexico-city";
          const cell = cells.get(g.group);
          const pred = predictedOrder(cell, g.table);
          return (
            <Link
              key={g.group}
              href={`/pool/${code}/matches?view=groups&fx=group#group-${g.group}`}
              aria-label={`Group ${g.group} fixtures`}
              className="relative block overflow-hidden rounded-xl border border-line bg-surface p-3 text-sm transition-colors hover:bg-surface-sunk focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <GroupLetterMark letter={g.group} city={city} />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  Group {g.group}
                </span>
                {!g.started && g.firstMatchAt ? (
                  <span className="ml-auto font-mono text-[10px] font-medium text-ink-3">
                    {formatMatchDate(g.firstMatchAt)}
                  </span>
                ) : (
                  <PointsPill cell={cell} />
                )}
              </div>
              {g.table.length > 0 ? (
                <table className="mt-2 w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="text-ink-4">
                      <th className="text-left font-medium">#</th>
                      <th className="text-left font-medium">Team</th>
                      <th className="text-left font-medium">Form</th>
                      <th className="text-right font-medium">GF</th>
                      <th className="text-right font-medium">GA</th>
                      <th className="text-right font-medium">GD</th>
                      <th className="text-right font-medium">Pts</th>
                      <th className="border-l border-line pl-1.5 text-left font-medium">You</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.table.map((r: GroupTableRow, i: number) => {
                      const advancing = r.rank <= 2;
                      const isThird = r.rank === 3;
                      const p = pred[i];
                      const ps = PRED_STYLE[p?.kind ?? "rest"];
                      return (
                        <tr
                          key={r.code}
                          className={
                            advancing
                              ? "font-bold text-ink"
                              : isThird
                                ? "text-ink-2"
                                : "text-ink-4"
                          }
                        >
                          <td className="py-0.5 text-left font-mono">{r.rank}</td>
                          <td className="py-0.5 text-left">
                            <span className="flex items-center gap-1.5">
                              <Flag code={r.code} size={16} />
                              {r.code}
                            </span>
                          </td>
                          <td className="py-0.5 text-left">
                            <FormChips w={r.w} d={r.d} l={r.l} />
                          </td>
                          <td className="py-0.5 text-right tabular-nums">{r.gf}</td>
                          <td className="py-0.5 text-right tabular-nums">{r.ga}</td>
                          <td className="py-0.5 text-right tabular-nums">
                            {r.gd > 0 ? `+${r.gd}` : r.gd}
                          </td>
                          <td className="py-0.5 text-right font-mono tabular-nums">{r.pts}</td>
                          <td className="border-l border-line py-0.5 pl-1.5 text-left">
                            <span className={ps.cls} title={ps.title}>
                              {p?.code ?? "—"}
                              {p && predSuffix(p) ? (
                                <span className="ml-0.5 tabular-nums">{predSuffix(p)}</span>
                              ) : null}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <>
                  <p className="mt-2">
                    <span className="font-mono text-ink-4">1.</span>{" "}
                    <span className="font-medium text-ink">{g.first ?? "—"}</span>
                  </p>
                  <p>
                    <span className="font-mono text-ink-4">2.</span>{" "}
                    <span className="font-medium text-ink">{g.second ?? "—"}</span>
                  </p>
                </>
              )}
            </Link>
          );
        })}
      </div>

      {view.thirdsTable.length > 0 ? (
        <div className="rounded-xl border border-line bg-surface p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
              Third-place standings
            </p>
            {selected.breakdown.thirdsLiveDelta > 0 ? (
              <span className="rounded-full border border-gold/40 bg-gold-tint px-2 py-0.5 text-[10px] font-bold tabular-nums text-gold-dark">
                ⚡ +{selected.breakdown.thirdsLiveDelta}
              </span>
            ) : null}
          </div>
          <table className="mt-2 w-full border-collapse text-[11px]">
            <thead>
              <tr className="text-ink-4">
                <th className="text-left font-medium">#</th>
                <th className="text-left font-medium">Grp</th>
                <th className="text-left font-medium">Team</th>
                <th className="text-right font-medium">GD</th>
                <th className="text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {view.thirdsTable.map((r, i) => {
                const picked = thirdPicks.has(r.code);
                // The cut line: 9th-placed third is the first that misses the Round of 32.
                const cutoff = i === 8 ? "border-t-2 border-dashed border-gold/60" : "";
                return (
                  <tr key={r.code} className={`${cutoff} ${r.advancing ? "font-bold text-ink" : "text-ink-4"}`}>
                    <td className="py-0.5 text-left font-mono">{i + 1}</td>
                    <td className="py-0.5 text-left">{r.group}</td>
                    <td className="w-full py-0.5 text-left">
                      <span className="flex items-center gap-1.5">
                        <Flag code={r.code} size={16} />
                        {r.code}
                        <span className="truncate font-normal text-ink-4">{TEAMS[r.code]}</span>
                        {picked ? (
                          <span
                            className={`ml-0.5 text-[10px] font-bold tabular-nums ${r.advancing ? "text-pitch" : "text-red-500"}`}
                            title={
                              r.advancing
                                ? "Your 3rd-place pick — advancing as a best-3rd"
                                : "Your 3rd-place pick — currently out"
                            }
                          >
                            {r.advancing ? `+${selected.breakdown.thirdAdvancerPoints}` : "✗"}
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="py-0.5 text-right tabular-nums">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="py-0.5 text-right font-mono tabular-nums">{r.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-ink-4">Top 8 advance to the Round of 32.</p>
        </div>
      ) : null}
    </div>
  );
}
