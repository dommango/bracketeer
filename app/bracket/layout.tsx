import Link from "next/link";

export default function BracketLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[480px] px-5 pb-12 pt-10">
      <Link
        href="/"
        className="mb-4 inline-block text-xs font-semibold text-ink-3 hover:text-ink-2"
      >
        ← Home
      </Link>
      {children}
    </main>
  );
}
