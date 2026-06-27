"use client";

import { useActionState } from "react";
import { saveEntryPicksAction } from "./actions";

interface SlotData {
  matchNo: number;
  round: string;
  teamA: { code: string; name: string } | null;
  teamB: { code: string; name: string } | null;
  currentPick: string | null;
  isBad: boolean;
  isMissing: boolean;
}

interface AwardField {
  key: string;
  label: string;
  value: string;
}

interface Props {
  entryId: string;
  slots: SlotData[];
  awards: AwardField[];
}

const ROUND_ORDER = ["Round of 32", "Round of 16", "Quarter-finals", "Semi-finals", "Final"];

export function KnockoutPickForm({ entryId, slots, awards }: Props) {
  const boundAction = saveEntryPicksAction.bind(null, entryId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    null as { ok: boolean; message: string } | null,
  );

  const rounds = ROUND_ORDER.map((round) => ({
    label: round,
    slots: slots.filter((s) => s.round === round),
  })).filter((r) => r.slots.length > 0);

  return (
    <form
      action={formAction}
      className="mt-5 space-y-5"
    >
      {rounds.map(({ label, slots: roundSlots }) => (
        <section key={label}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-black/50">
            {label}
          </h2>
          <div className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white">
            {roundSlots.map((s) => {
              const hasBothTeams = s.teamA && s.teamB;

              return (
                <div
                  key={s.matchNo}
                  className={`flex items-center gap-3 px-4 py-3 ${s.isBad ? "bg-red-50" : ""}`}
                >
                  <span className="w-10 shrink-0 text-xs font-mono text-black/40">
                    M{s.matchNo}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-black/70">
                    {s.teamA && s.teamB ? (
                      <>
                        {s.teamA.name}{" "}
                        <span className="text-black/30">vs</span>{" "}
                        {s.teamB.name}
                      </>
                    ) : (
                      <span className="italic text-black/30">
                        {s.teamA ? `${s.teamA.name} vs TBD` : "TBD vs TBD"}
                      </span>
                    )}
                    {s.isBad && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        wrong team
                      </span>
                    )}
                  </span>
                  <select
                    name={`m${s.matchNo}`}
                    defaultValue={s.currentPick ?? ""}
                    className={`rounded-lg border px-2 py-1.5 text-sm ${
                      s.isBad
                        ? "border-red-300 bg-red-50 text-red-900"
                        : "border-black/15 text-black"
                    }`}
                  >
                    <option value="">— clear —</option>
                    {hasBothTeams ? (
                      <>
                        <option value={s.teamA!.code}>{s.teamA!.name}</option>
                        <option value={s.teamB!.code}>{s.teamB!.name}</option>
                      </>
                    ) : (
                      // Feeder teams not yet resolved — show current pick if any
                      s.currentPick && (
                        <option value={s.currentPick}>{s.currentPick}</option>
                      )
                    )}
                    {/* Show bad pick as an option so admin can see what's there */}
                    {s.isBad && s.currentPick && hasBothTeams && (
                      <option value={s.currentPick} disabled>
                        {s.currentPick} (invalid — not in this match)
                      </option>
                    )}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-black/50">
          Player awards
        </h2>
        <div className="divide-y divide-black/5 rounded-2xl border border-black/10 bg-white">
          {awards.map((a) => (
            <div key={a.key} className="flex items-center gap-3 px-4 py-3">
              <label htmlFor={`award:${a.key}`} className="min-w-0 flex-1 text-sm text-black/70">
                {a.label}
              </label>
              <input
                id={`award:${a.key}`}
                name={`award:${a.key}`}
                defaultValue={a.value}
                placeholder="— none —"
                className="w-44 rounded-lg border border-black/15 px-2 py-1.5 text-sm text-black"
              />
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pb-6">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-pitch px-5 py-2 font-medium text-white hover:bg-pitch/80 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save picks & recompute"}
        </button>
        {state && (
          <p className={`text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
