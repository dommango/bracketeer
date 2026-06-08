"use client";

import { useActionState } from "react";
import { saveKnockoutAction, type KnockoutActionState } from "./actions";

export interface KnockoutRowData {
  matchNo: number;
  roundLabel: string;
  homeLabel: string;
  awayLabel: string;
  currentWinner: string;
  currentHomeScore: number | null;
  currentAwayScore: number | null;
  options: { code: string; label: string }[];
}

function KnockoutRow({ row }: { row: KnockoutRowData }) {
  const [state, action, pending] = useActionState<KnockoutActionState, FormData>(
    saveKnockoutAction,
    {},
  );

  return (
    <form action={action} className="rounded-xl border border-black/10 bg-white p-3 text-sm">
      <input type="hidden" name="matchNo" value={row.matchNo} />
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-black/50">M{row.matchNo}</span>
        <span className="text-xs text-black/40">{row.roundLabel}</span>
      </div>
      <p className="mt-1 font-medium">
        {row.homeLabel} <span className="text-black/40">vs</span> {row.awayLabel}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          name="winner"
          defaultValue={row.currentWinner}
          className="min-w-[9rem] flex-1 rounded-lg border border-black/15 px-2 py-1.5"
        >
          <option value="">— not decided —</option>
          {row.options.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          name="homeScore"
          type="number"
          min="0"
          placeholder="H"
          defaultValue={row.currentHomeScore ?? ""}
          className="w-14 rounded-lg border border-black/15 px-2 py-1.5"
          aria-label={`${row.homeLabel} score`}
        />
        <input
          name="awayScore"
          type="number"
          min="0"
          placeholder="A"
          defaultValue={row.currentAwayScore ?? ""}
          className="w-14 rounded-lg border border-black/15 px-2 py-1.5"
          aria-label={`${row.awayLabel} score`}
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-pitch px-4 py-1.5 font-medium text-white hover:bg-pitch-dark disabled:opacity-50"
        >
          {pending ? "…" : "Save"}
        </button>
        {state.message ? (
          <span className={state.ok ? "text-green-600" : "text-red-600"}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}

export function KnockoutEditor({ rows }: { rows: KnockoutRowData[] }) {
  const byRound = new Map<string, KnockoutRowData[]>();
  for (const r of rows) {
    const list = byRound.get(r.roundLabel) ?? [];
    list.push(r);
    byRound.set(r.roundLabel, list);
  }

  return (
    <div className="space-y-6">
      {[...byRound.entries()].map(([round, group]) => (
        <div key={round}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/50">
            {round}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.map((row) => (
              <KnockoutRow key={row.matchNo} row={row} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
