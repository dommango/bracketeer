// Team brand/kit colors for the 48 WC2026 nations, keyed by the same 3-letter
// codes as TEAMS in lib/scoring/data.ts. Pure + env-free: used to tint the
// win-probability and title-odds bars with the colors of the teams playing.
// `secondary` is a distinct fallback used when two opponents' primaries clash.

export interface TeamColors {
  primary: string;
  secondary: string;
}

// Neutral grey for the draw segment and any unknown/unresolved team.
export const NEUTRAL = "#9aa3a0";

// Textured neutral for the draw share of an odds bar: a subtle diagonal hatch
// over NEUTRAL so "neither team" reads distinctly from the flat team tints
// (feedback: make the draw a textured gray). A CSS gradient — usable as a
// `background`, not as a text color, so keep NEUTRAL for any draw label.
export const DRAW_FILL =
  `repeating-linear-gradient(45deg, ${NEUTRAL} 0, ${NEUTRAL} 3px, #b4bbb8 3px, #b4bbb8 6px)`;

export const TEAM_COLORS: Record<string, TeamColors> = {
  MEX: { primary: "#006847", secondary: "#ce1126" },
  RSA: { primary: "#007a4d", secondary: "#ffb612" },
  KOR: { primary: "#cd2e3a", secondary: "#0047a0" },
  CZE: { primary: "#11457e", secondary: "#d7141a" },
  CAN: { primary: "#d52b1e", secondary: "#1a1a1a" },
  BIH: { primary: "#002395", secondary: "#ffec00" },
  QAT: { primary: "#8d1b3d", secondary: "#b03a5b" },
  SUI: { primary: "#d52b1e", secondary: "#3a3a3a" },
  BRA: { primary: "#ffdf00", secondary: "#009c3b" },
  MAR: { primary: "#c1272d", secondary: "#006233" },
  HAI: { primary: "#00209f", secondary: "#d21034" },
  SCO: { primary: "#1b3a6b", secondary: "#005eb8" },
  USA: { primary: "#3c3b6e", secondary: "#b22234" },
  PAR: { primary: "#d52b1e", secondary: "#0038a8" },
  AUS: { primary: "#00843d", secondary: "#ffcd00" },
  TUR: { primary: "#e30a17", secondary: "#8a0a12" },
  GER: { primary: "#111111", secondary: "#ffcc00" },
  CUW: { primary: "#002b7f", secondary: "#f9e814" },
  CIV: { primary: "#f77f00", secondary: "#009e60" },
  ECU: { primary: "#ffd100", secondary: "#0033a0" },
  NED: { primary: "#ff6200", secondary: "#21468b" },
  JPN: { primary: "#002b7f", secondary: "#bc002d" },
  SWE: { primary: "#006aa7", secondary: "#fecc02" },
  TUN: { primary: "#e70013", secondary: "#8a000c" },
  BEL: { primary: "#ef3340", secondary: "#fdda24" },
  EGY: { primary: "#ce1126", secondary: "#1a1a1a" },
  IRN: { primary: "#239f40", secondary: "#da0000" },
  NZL: { primary: "#1a1a1a", secondary: "#9a9a9a" },
  ESP: { primary: "#aa151b", secondary: "#f1bf00" },
  CPV: { primary: "#003893", secondary: "#cf2027" },
  KSA: { primary: "#006c35", secondary: "#00432a" },
  URU: { primary: "#5b92e5", secondary: "#001489" },
  FRA: { primary: "#002395", secondary: "#ed2939" },
  SEN: { primary: "#00853f", secondary: "#fdef42" },
  IRQ: { primary: "#007a3d", secondary: "#ce1126" },
  NOR: { primary: "#ba0c2f", secondary: "#00205b" },
  ARG: { primary: "#6cace4", secondary: "#f6b40e" },
  ALG: { primary: "#006233", secondary: "#d21034" },
  AUT: { primary: "#ed2939", secondary: "#8a0a18" },
  JOR: { primary: "#ce1126", secondary: "#1a1a1a" },
  POR: { primary: "#da291c", secondary: "#006600" },
  COD: { primary: "#007fff", secondary: "#f7d518" },
  UZB: { primary: "#0099b5", secondary: "#1eb53a" },
  COL: { primary: "#fcd116", secondary: "#003893" },
  ENG: { primary: "#c8102e", secondary: "#002366" },
  CRO: { primary: "#d10000", secondary: "#0d4a9e" },
  GHA: { primary: "#ce1126", secondary: "#fcd116" },
  PAN: { primary: "#d21034", secondary: "#005293" },
};

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// Squared RGB distance — cheap, deterministic, no deps. 0 (identical) … 195075.
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;
}

// Below this squared distance two colors read as "the same" in adjacent segments.
const CLASH_THRESHOLD = 3000;

// A team's display color (its primary), or NEUTRAL for null/unknown codes.
export function teamColor(code: string | null | undefined): string {
  if (!code) return NEUTRAL;
  return TEAM_COLORS[code]?.primary ?? NEUTRAL;
}

// Pick distinguishable colors for two opposing teams. Home keeps its primary; the
// away side falls back to its secondary, then NEUTRAL, when the primaries clash.
export function resolvePair(
  home: string | null | undefined,
  away: string | null | undefined,
): { home: string; away: string } {
  const homeColor = teamColor(home);
  const awayPrimary = teamColor(away);
  if (colorDistance(homeColor, awayPrimary) >= CLASH_THRESHOLD) {
    return { home: homeColor, away: awayPrimary };
  }
  const awaySecondary = away && TEAM_COLORS[away] ? TEAM_COLORS[away].secondary : NEUTRAL;
  if (colorDistance(homeColor, awaySecondary) >= CLASH_THRESHOLD) {
    return { home: homeColor, away: awaySecondary };
  }
  return { home: homeColor, away: NEUTRAL };
}
