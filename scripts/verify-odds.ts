import { pollOdds } from "@/lib/odds/poll";

async function main() {
  const summary = await pollOdds();
  console.log("odds poll summary:", JSON.stringify(summary, null, 2));
  if (summary.unmatched.length) {
    console.log("\nUNMATCHED EVENTS (add aliases in lib/odds/map.ts):");
    for (const u of summary.unmatched) console.log("  -", u);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
