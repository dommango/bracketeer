// One-off forced refresh of the knockout slate's betting + insight data, for use
// the day before the Round of 32 (when no snapshot/cron window is open yet and the
// normal pollers would skip). Pulls, in order:
//   • h2h win/draw odds          — pollOdds({ force })       (1 Odds API credit)
//   • Over/Under totals + champion/Golden-Boot outrights — pollOddsExtras()  (3 credits)
//   • model prediction / form / h2h — pollPredictions({ force, max })  (≤1 API-Football call per R32 fixture)
// Each layer is independent and degrades gracefully when its key is unset.
//
//   env $ENV npx tsx scripts/refresh-knockout-odds.ts

import { pollOdds } from "@/lib/odds/poll";
import { pollOddsExtras } from "@/lib/odds/extras";
import { pollPredictions } from "@/lib/sports/predictions";

async function main() {
  const odds = await pollOdds({ force: true });
  console.log("h2h odds:", JSON.stringify(odds, null, 2));
  if (odds.unmatched.length) {
    console.log("\nUNMATCHED EVENTS (add aliases in lib/odds/map.ts):");
    for (const u of odds.unmatched) console.log("  -", u);
  }

  const extras = await pollOddsExtras();
  console.log("\nextras (totals + outrights):", JSON.stringify(extras, null, 2));

  // 16 R32 fixtures > the default per-run cap, so raise it and force past the
  // freshness-skip to refresh the whole knockout slate now.
  const predictions = await pollPredictions(new Date(), { force: true, max: 32 });
  console.log("\npredictions:", JSON.stringify(predictions, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
