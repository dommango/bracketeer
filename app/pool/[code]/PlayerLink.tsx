import Link from "next/link";

// Wraps a player name in a link to the player drill-down. Identity is name-based
// (no player id), so the name is URL-encoded into the path. Flat-context only
// (no nested <a>); renders children unlinked when there is no name.
export function PlayerLink({
  poolCode,
  name,
  className,
  children,
}: {
  poolCode: string;
  name: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  if (!name) return <>{children}</>;
  return (
    <Link
      href={`/pool/${poolCode}/players/${encodeURIComponent(name)}`}
      className={
        className ??
        "underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      }
    >
      {children}
    </Link>
  );
}
