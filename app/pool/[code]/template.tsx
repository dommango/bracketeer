import type { ReactNode } from "react";

// A template re-mounts its subtree on every navigation within the pool shell, so
// the CSS drill-enter animation (globals.css) replays for each drill-down —
// group → fixtures, city → venue, match → detail — one uniform transition.
// Reduced motion is honoured by the global guard in globals.css.
export default function PoolTemplate({ children }: { children: ReactNode }) {
  return <div className="drill-enter">{children}</div>;
}
