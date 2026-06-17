import type { MatchDetail } from "@/lib/pool/queries";
import { Flag } from "../../Flag";

const SECTION_LABEL = "px-1 text-xs font-bold uppercase tracking-[0.08em] text-ink-3";

const MEETING_DATE = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

const meetingDate = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : MEETING_DATE.format(d);
};

// Score color from the current home team's perspective.
const OUTCOME_COLOR: Record<string, string> = {
  home: "var(--pitch)",
  away: "var(--round-r16)",
  draw: "var(--ink-4)",
};

const FORM_COLOR: Record<string, string> = {
  W: "var(--positive)",
  D: "var(--ink-4)",
  L: "var(--negative)",
};

// Recent-form chips, most-recent last (e.g. "WWDLW"). Unknown chars are skipped.
function FormChips({ form }: { form: string | null }) {
  const chars = (form ?? "").toUpperCase().split("").filter((c) => c in FORM_COLOR);
  if (chars.length === 0) return <span className="text-[11px] text-ink-4">—</span>;
  return (
    <span className="flex gap-0.5">
      {chars.map((c, i) => (
        <span
          key={i}
          className="inline-flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold text-white"
          style={{ background: FORM_COLOR[c] }}
        >
          {c}
        </span>
      ))}
    </span>
  );
}

// Pre-match insights panel: model win %, advice, each side's recent form, and a
// head-to-head record. Renders nothing until the predictions poll has data.
export function MatchInsights({
  prediction,
  home,
  away,
}: {
  prediction: MatchDetail["prediction"];
  home: MatchDetail["home"];
  away: MatchDetail["away"];
}) {
  if (!prediction) return null;
  const { homePercent, drawPercent, awayPercent, advice, homeForm, awayForm, h2h } = prediction;
  const hasPercent = homePercent != null && drawPercent != null && awayPercent != null;

  return (
    <section>
      <h3 className={`mb-2 ${SECTION_LABEL}`}>Match insights</h3>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        {hasPercent ? (
          <div>
            <div className="mb-1 flex h-1.5 overflow-hidden rounded-full">
              <span style={{ width: `${homePercent}%`, background: "var(--pitch)" }} />
              <span style={{ width: `${drawPercent}%`, background: "var(--ink-4)" }} />
              <span style={{ width: `${awayPercent}%`, background: "var(--round-r16)" }} />
            </div>
            <div className="flex justify-between font-mono text-[10px]">
              <span style={{ color: "var(--pitch)" }}>{home.code ?? "Home"} {homePercent}%</span>
              <span style={{ color: "var(--ink-4)" }}>Draw {drawPercent}%</span>
              <span style={{ color: "var(--round-r16)" }}>{away.code ?? "Away"} {awayPercent}%</span>
            </div>
          </div>
        ) : null}

        {advice ? (
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">Tip:</span> {advice}
          </p>
        ) : null}

        {homeForm || awayForm ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <Flag code={home.code} size={16} />
              <span className="w-10 shrink-0 font-mono text-ink-3">{home.code}</span>
              <FormChips form={homeForm} />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Flag code={away.code} size={16} />
              <span className="w-10 shrink-0 font-mono text-ink-3">{away.code}</span>
              <FormChips form={awayForm} />
            </div>
          </div>
        ) : null}

        {h2h ? (
          <div className="space-y-1.5">
            <p className="text-xs text-ink-3">
              <span className="font-semibold text-ink-2">Head-to-head</span> (last {h2h.played}):{" "}
              {home.code} {h2h.homeWins}
              <span className="text-ink-4"> · </span>
              {h2h.draws} draw{h2h.draws === 1 ? "" : "s"}
              <span className="text-ink-4"> · </span>
              {h2h.awayWins} {away.code}
            </p>
            {(h2h.meetings ?? []).length > 0 ? (
              <ul className="space-y-0.5">
                {(h2h.meetings ?? []).map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between font-mono text-[11px] tabular-nums text-ink-3"
                  >
                    <span className="text-ink-4">{meetingDate(m.date)}</span>
                    <span>
                      {home.code}{" "}
                      <span className="font-semibold" style={{ color: OUTCOME_COLOR[m.outcome] }}>
                        {m.homeGoals}–{m.awayGoals}
                      </span>{" "}
                      {away.code}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
