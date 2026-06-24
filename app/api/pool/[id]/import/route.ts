// POST /api/pool/[id]/import — import contestant pick CSV(s) into a pool.
// Owner/admin only. Accepts either a JSON body { csv } (single contestant) or a
// multipart upload with one or more "file" fields (the per-contestant exports
// from the original tool). Recomputes the leaderboard and notifies listeners.

import { NextRequest } from "next/server";
import { z } from "zod";
import { getPoolAccess, canManagePool } from "@/lib/pool/access";
import { parseSubmissionCsv, importSubmission, type ImportResult } from "@/lib/pool/import";
import { recomputePool } from "@/lib/pool/scoring";
import { notifyPool } from "@/lib/realtime/notify";
import { rateLimit } from "@/lib/rate-limit";
import { apiOk, apiError } from "@/lib/api";

export const dynamic = "force-dynamic";

// A single contestant export is a few KB; these bounds stop an oversized or
// many-file upload from exhausting memory.
const MAX_CSV_BYTES = 1_000_000;
const MAX_FILES = 200;

const jsonSchema = z.object({
  csv: z.string().min(1, "csv is empty").max(MAX_CSV_BYTES, "csv is too large"),
});

interface FileOutcome {
  name: string;
  ok: boolean;
  result?: ImportResult;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: poolId } = await params;

  const access = await getPoolAccess(poolId);
  // 404 (not 403) when the pool is missing or the user can't see it, to avoid
  // leaking pool existence to non-members.
  if (!access) return apiError("Pool not found", 404);
  if (!canManagePool(access)) return apiError("Forbidden: owner or admin only", 403);

  // Imports are heavy (parse + persist + full recompute); cap per manager.
  if (!(await rateLimit(`import:${access.user.id}`, 10, 60_000)).ok) {
    return apiError("Too many imports — wait a minute and try again.", 429);
  }

  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const files = form.getAll("file").filter((f): f is File => f instanceof File);
      if (files.length === 0) return apiError("No 'file' upload provided", 400);
      if (files.length > MAX_FILES) return apiError(`Too many files (max ${MAX_FILES})`, 413);

      const outcomes: FileOutcome[] = [];
      for (const file of files) {
        try {
          if (file.size > MAX_CSV_BYTES) throw new Error("File too large");
          const sub = parseSubmissionCsv(await file.text());
          outcomes.push({ name: file.name, ok: true, result: await importSubmission(poolId, sub) });
        } catch (err) {
          outcomes.push({ name: file.name, ok: false, error: (err as Error).message });
        }
      }

      const importedCount = outcomes.filter((o) => o.ok).length;
      if (importedCount > 0) {
        await recomputePool(poolId);
        await notifyPool(poolId, "leaderboard");
      }
      return apiOk({ outcomes }, { meta: { imported: importedCount, total: files.length } });
    }

    // JSON path: a single contestant CSV.
    const { csv } = jsonSchema.parse(await req.json());
    const result = await importSubmission(poolId, parseSubmissionCsv(csv));
    await recomputePool(poolId);
    await notifyPool(poolId, "leaderboard");
    return apiOk(result);
  } catch (err) {
    console.error("pool import failed:", err);
    return apiError(`Import failed: ${(err as Error).message}`, 422);
  }
}
