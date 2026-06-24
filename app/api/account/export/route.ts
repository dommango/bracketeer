// GET /api/account/export — download everything we hold about the signed-in user
// as a JSON file (GDPR data access / portability). Session-gated; a user can only
// export their own data.

import { getSessionUser } from "@/lib/pool/access";
import { apiError } from "@/lib/api";
import { exportUserData } from "@/lib/account/export";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return apiError("unauthorized", 401);

  const data = await exportUserData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="bracketeer-my-data.json"',
    },
  });
}
