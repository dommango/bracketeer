import Link from "next/link";

// Wraps any team flag/name in a link to the team drill-down. Use only in FLAT
// contexts (odds lists, analytics rows, scorer rows, match-detail header) — never
// inside a card-level <Link> (no nested <a>). Renders children unlinked when the
// team code is unknown (TBD slots), so it's always safe to drop in.
//
// The link target is `${base}/teams/${code}`, where base is the pool path
// (`/pool/<code>`) by default or an explicit `basePath` for non-pool callers —
// the public challenges pass `/challenge/md3` | `/challenge/knockout`. With
// neither set, children render unlinked.
export function TeamLink({
  poolCode,
  basePath,
  code,
  className,
  children,
}: {
  poolCode?: string;
  basePath?: string;
  code: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const base = basePath ?? (poolCode ? `/pool/${poolCode}` : null);
  if (!code || !base) return <>{children}</>;
  return (
    <Link
      href={`${base}/teams/${code}`}
      className={
        className ??
        "underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      }
    >
      {children}
    </Link>
  );
}
