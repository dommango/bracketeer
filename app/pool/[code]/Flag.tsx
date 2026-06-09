// Real SVG country flags served from flagcdn.com, keyed by the WC2026 team
// codes used in lib/scoring/data.ts. Subdivisions (gb-eng, gb-sct) cover
// England and Scotland. For offline-safe builds, self-host the SVGs and pass
// a `src` override.

export const TEAM_TO_ISO2: Record<string, string> = {
  MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz", CAN: "ca", BIH: "ba", QAT: "qa", SUI: "ch",
  BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct", USA: "us", PAR: "py", AUS: "au", TUR: "tr",
  GER: "de", CUW: "cw", CIV: "ci", ECU: "ec", NED: "nl", JPN: "jp", SWE: "se", TUN: "tn",
  BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz", ESP: "es", CPV: "cv", KSA: "sa", URU: "uy",
  FRA: "fr", SEN: "sn", IRQ: "iq", NOR: "no", ARG: "ar", ALG: "dz", AUT: "at", JOR: "jo",
  POR: "pt", COD: "cd", UZB: "uz", COL: "co", ENG: "gb-eng", CRO: "hr", GHA: "gh", PAN: "pa",
};

export function Flag({
  code,
  size = 20,
  className,
}: {
  code: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const iso2 = code ? TEAM_TO_ISO2[code] : undefined;
  if (!iso2) return null;
  const height = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/${iso2}.svg`}
      alt=""
      width={size}
      height={height}
      loading="lazy"
      className={className}
      style={{
        width: size,
        height,
        borderRadius: 3,
        objectFit: "cover",
        flexShrink: 0,
        boxShadow: "inset 0 0 0 1px rgba(10,15,13,0.08)",
        background: "var(--surface-sunk)",
      }}
    />
  );
}
