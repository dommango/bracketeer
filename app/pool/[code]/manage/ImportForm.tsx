"use client";

import { useActionState } from "react";
import { importCsvAction, type ImportState } from "./actions";

// CSV import with inline result feedback. Accepts the per-contestant exports from
// the original bracket tool (multiple files at once).
export function ImportForm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<ImportState, FormData>(
    importCsvAction,
    {},
  );

  return (
    <form action={formAction} className="mt-3 space-y-3">
      <input type="hidden" name="code" value={code} />
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        multiple
        required
        className="block w-full text-sm text-ink-2 file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-surface-sunk file:px-4 file:text-sm file:font-semibold file:text-pitch-dark hover:file:bg-line-soft"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-full bg-pitch px-5 text-sm font-semibold text-white hover:bg-pitch-dark disabled:opacity-60"
      >
        {pending ? "Importing…" : "Import CSV"}
      </button>

      {state.error ? <p className="text-sm text-live">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-pitch-dark">
          Imported {state.imported}
          {state.failed ? `, ${state.failed} failed` : ""}.
        </p>
      ) : null}
    </form>
  );
}
