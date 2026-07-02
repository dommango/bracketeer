// The static hero visual shell shared by the marketing <Hero/>, the <HeroCarousel/>,
// and the sign-in panel: the pitch-green rounded panel, the brand pattern layer, and
// the darkening gradient overlay. Callers slot their own copy as children.
//
// Two overlay variants match the existing surfaces exactly:
//   "bottom" — a bottom-anchored darken (Hero / HeroCarousel), keeping the artwork's
//              centre visible.
//   "full"   — a full-height darken (sign-in panel), for legible copy over the top.
//
// The pause handlers for the carousel live on this outer container, so it forwards
// the container-level pointer/focus handler props unchanged — no behavior moves.

const CONTAINER =
  "relative overflow-hidden rounded-[32px] bg-pitch p-8 text-white shadow-[var(--shadow-lg)]";

const PATTERN_STYLE = {
  backgroundImage: "url(/brand-26-pattern.avif)",
  backgroundSize: "cover",
  backgroundPosition: "center",
} as const;

const BOTTOM_GRADIENT =
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.45) 100%)";
const FULL_GRADIENT =
  "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)";

export function HeroShell({
  overlay = "bottom",
  children,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
}: {
  overlay?: "bottom" | "full";
  children: React.ReactNode;
  // Container-level handlers, forwarded so the carousel's hover/focus pause logic
  // keeps living on the outer panel exactly as before.
  onMouseEnter?: React.DOMAttributes<HTMLDivElement>["onMouseEnter"];
  onMouseLeave?: React.DOMAttributes<HTMLDivElement>["onMouseLeave"];
  onFocusCapture?: React.DOMAttributes<HTMLDivElement>["onFocusCapture"];
  onBlurCapture?: React.DOMAttributes<HTMLDivElement>["onBlurCapture"];
}) {
  return (
    <div
      className={CONTAINER}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
    >
      <div className="absolute inset-0" style={PATTERN_STYLE} />
      <div
        className={overlay === "full" ? "absolute inset-0" : "absolute inset-x-0 bottom-0 h-2/5"}
        style={{ background: overlay === "full" ? FULL_GRADIENT : BOTTOM_GRADIENT }}
      />
      {children}
    </div>
  );
}
