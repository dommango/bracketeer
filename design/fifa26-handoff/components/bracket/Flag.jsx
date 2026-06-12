import React from "react";

/* TEAM CODE → ISO-3166 alpha-2 for flagcdn.com. */
export const TEAM_TO_ISO2 = {
  MEX:"mx", RSA:"za", KOR:"kr", CZE:"cz",
  CAN:"ca", BIH:"ba", QAT:"qa", SUI:"ch",
  BRA:"br", MAR:"ma", HAI:"ht", SCO:"gb-sct",
  USA:"us", PAR:"py", AUS:"au", TUR:"tr",
  GER:"de", CUW:"cw", CIV:"ci", ECU:"ec",
  NED:"nl", JPN:"jp", SWE:"se", TUN:"tn",
  BEL:"be", EGY:"eg", IRN:"ir", NZL:"nz",
  ESP:"es", CPV:"cv", KSA:"sa", URU:"uy",
  FRA:"fr", SEN:"sn", IRQ:"iq", NOR:"no",
  ARG:"ar", ALG:"dz", AUT:"at", JOR:"jo",
  POR:"pt", COD:"cd", UZB:"uz", COL:"co",
  ENG:"gb-eng", CRO:"hr", GHA:"gh", PAN:"pa",
};

const defaultSrc = (iso2) => `https://flagcdn.com/${iso2}.svg`;

export function Flag({ code, size = 24, shape = "square", bordered = false, src = defaultSrc, alt }) {
  const iso2 = TEAM_TO_ISO2[code] || "un";
  const radius = shape === "circle" ? "50%" : shape === "rect" ? 3 : 4;
  const style = {
    display: "inline-block",
    width: size,
    height: shape === "rect" ? Math.round(size * 0.75) : size,
    borderRadius: radius,
    overflow: "hidden",
    background: "var(--surface-sunk)",
    boxShadow: bordered ? "inset 0 0 0 1px rgba(10,15,13,0.10)" : "none",
    verticalAlign: "middle",
    flexShrink: 0,
    objectFit: "cover",
  };
  return (
    <img
      src={src(iso2)}
      alt={alt ?? code}
      width={size}
      height={style.height}
      style={style}
      loading="lazy"
    />
  );
}
