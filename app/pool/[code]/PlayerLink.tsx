import Link from "next/link";

// Wraps a player name in a link to the player drill-down. Identity is name-based
// (no player id), so the name is URL-encoded into the path. Flat-context only
// (no nested <a>); renders children unlinked when there is no name.
//
// Target is `${base}/players/${name}`, where base is the pool path by default or
// an explicit `basePath` for non-pool callers (the public challenges). Unlinked
// when no base resolves.
export function PlayerLink({
  poolCode,
  basePath,
  name,
  className,
  children,
}: {
  poolCode?: string;
  basePath?: string;
  name: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  const base = basePath ?? (poolCode ? `/pool/${poolCode}` : null);
  if (!name || !base) return <>{children}</>;
  return (
    <Link
      href={`${base}/players/${encodeURIComponent(name)}`}
      className={
        className ??
        "underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      }
    >
      {children}
    </Link>
  );
}
