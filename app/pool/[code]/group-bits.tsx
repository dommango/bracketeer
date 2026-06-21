// Small presentation pieces shared by the plain group-standings cards
// (GroupStandings in Bracket.tsx) and the home-page bracket overlay
// (GroupOverlay.tsx). Pure JSX, no client/server-only deps.

// A–L → host-city slug (color + matching subtle pattern motif).
export const GROUP_CITY: Record<string, string> = {
  A: "mexico-city",
  B: "vancouver",
  C: "atlanta",
  D: "houston",
  E: "philadelphia",
  F: "los-angeles",
  G: "guadalajara",
  H: "kansas-city",
  I: "monterrey",
  J: "san-francisco",
  K: "boston",
  L: "new-york-nj",
};

// The group letter as a plain solid square in the group's city color.
export function GroupLetterMark({ letter, city }: { letter: string; city: string }) {
  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm font-display text-[13px] text-white"
      style={{ background: `var(--city-${city})`, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
    >
      {letter}
    </span>
  );
}

// W/D/L result chips in the team's actual match order, most-recent last (e.g.
// "WDL"). Padded with empty cells to a min of 3 so the column stays aligned.
export function FormChips({ form }: { form: string }) {
  const seq: string[] = form.toUpperCase().split("").filter((r) => r === "W" || r === "D" || r === "L");
  while (seq.length < 3) seq.push("");
  const color = (r: string) =>
    r === "W" ? "#22c55e" : r === "D" ? "#9ca3af" : r === "L" ? "#ef4444" : "transparent";
  return (
    <span className="inline-flex gap-0.5">
      {seq.map((r, i) => (
        <span
          key={i}
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[8px] font-bold text-white"
          style={{ background: color(r), border: r ? "none" : "1px solid var(--line)" }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}
