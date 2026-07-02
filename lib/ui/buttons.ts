// Shared button class strings, so the app's primary and secondary CTAs stay
// pixel-identical wherever they appear (home hub, promos, forms, invites, billing).
// Callers append state modifiers (e.g. `disabled:opacity-60`) as needed.

export const PRIMARY_BUTTON =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-pitch px-[18px] font-semibold text-white transition-colors hover:bg-pitch-dark active:scale-[0.99]";

export const SECONDARY_BUTTON =
  "inline-flex h-11 w-full items-center justify-center rounded-full border border-line bg-surface px-[18px] font-semibold text-pitch-dark transition-colors hover:bg-surface-sunk active:scale-[0.97]";
