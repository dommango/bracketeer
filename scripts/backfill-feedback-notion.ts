// One-off: mirror Feedback rows that never reached Notion (notionUrl IS NULL).
// Idempotent — each success records notionUrl, so re-runs skip already-synced rows.
import { prisma } from "@/lib/db";
import { syncFeedbackToNotion } from "@/lib/notion/feedback-sync";

async function main() {
  const rows = await prisma.feedback.findMany({
    where: { notionUrl: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, type: true, title: true, description: true,
      pageUrl: true, userEmail: true, screenshots: true,
    },
  });

  console.log(`${rows.length} unsynced feedback row(s).`);
  let ok = 0;
  for (const r of rows) {
    const screenshotCount = Array.isArray(r.screenshots) ? r.screenshots.length : 0;
    const url = await syncFeedbackToNotion({
      type: r.type,
      title: r.title,
      description: r.description,
      pageUrl: r.pageUrl,
      userEmail: r.userEmail,
      screenshotCount,
    });
    if (url) {
      await prisma.feedback.update({ where: { id: r.id }, data: { notionUrl: url } });
      ok++;
      console.log(`  ✓ ${r.title.slice(0, 50)}`);
    } else {
      console.log(`  ✗ ${r.title.slice(0, 50)} (sync returned null)`);
    }
  }
  console.log(`Done — ${ok}/${rows.length} synced.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
