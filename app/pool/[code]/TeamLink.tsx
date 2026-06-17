import Link from "next/link";

// Wraps any team flag/name in a link to the team drill-down. Use only in FLAT
// contexts (odds lists, analytics rows, scorer rows, match-detail header) — never
// inside a card-level <Link> (no nested <a>). Renders children unlinked when the
// team code is unknown (TBD slots), so it's always safe to drop in.
export function TeamLink({
  poolCode,
  code,
  className,
  children,
}: {
  poolCode: string;
  code: string | null | undefined;
  className?: string;
  children: React.ReactNode;
}) {
  if (!code) return <>{children}</>;
  return (
    <Link
      href={`/pool/${poolCode}/teams/${code}`}
      className={
        className ??
        "underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pitch"
      }
    >
      {children}
    </Link>
  );
}
