// Pure logic for the unified picks accordion, kept out of the React component so
// the default-open rule is unit-testable.

import { featuredGame } from "@/lib/pool/games";

export type PicksSectionKey = "md3" | "knockout";

// Which accordion section opens by default: the featured game when it still has
// picks to make, otherwise whichever game is incomplete, otherwise the featured
// game (so something is always open even when both are done).
export function defaultOpenSection(args: {
  md3Incomplete: boolean;
  knockoutIncomplete: boolean;
  now?: Date;
}): PicksSectionKey {
  const featured: PicksSectionKey =
    featuredGame(args.now ?? new Date()) === "KNOCKOUT" ? "knockout" : "md3";
  const incomplete: Record<PicksSectionKey, boolean> = {
    md3: args.md3Incomplete,
    knockout: args.knockoutIncomplete,
  };
  if (incomplete[featured]) return featured;
  const other: PicksSectionKey = featured === "md3" ? "knockout" : "md3";
  if (incomplete[other]) return other;
  return featured;
}
