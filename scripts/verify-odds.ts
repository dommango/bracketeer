import { pollOdds } from "@/lib/odds/poll";
import { pollMatchProps } from "@/lib/odds/per-match";

async function main() {
  const summary = await pollOdds();
  console.log("odds poll summary:", JSON.stringify(summary, null, 2));
  if (summary.unmatched.length) {
    console.log("\nUNMATCHED EVENTS (add aliases in lib/odds/map.ts):");
    for (const u of summary.unmatched) console.log("  -", u);
  }

  const props = await pollMatchProps();
  console.log("\nmatch props poll summary:", JSON.stringify(props, null, 2));
  if (props.unmatched.length) {
    console.log("\nUNMATCHED PROP MATCHES (no Odds API event id resolved):");
    for (const u of props.unmatched) console.log("  -", u);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
