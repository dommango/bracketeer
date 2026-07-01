// The shared section-label style: a small, bold, upper-cased eyebrow used across
// forms, dashboards, and pool cards. Kept in one place so the many surfaces that
// use it can't drift apart. (Variants with extra utilities like `px-1` compose
// this by appending to it, or stay local when their base differs.)

export const LABEL = "text-xs font-bold uppercase tracking-[0.08em] text-ink-3";
