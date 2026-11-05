// Budgets over counted work, checked by `frameproof check` (exit 1 on a break, for CI). Each rule reads one
// scenario's step and says the most it may cost; the least count over the repetitions is what's checked.
// `r` holds the totals (rafs, timers, forced, styles, layouts, paints, scriptMs, styleMs, layoutMs, busyMs,
// styleElements, layoutObjects) and two helpers: r.asked(kind, /where/) for frames ('rAF') or timers ('timer')
// asked for from a source location, and r.forced(kind, /where/) for style or layout forced there.
// Start from what `frameproof ledger -s idle` shows, and lower a rule when a change lowers its count for good.
export default [
  { scenario: 'idle', step: 'rest', says: 'at rest, nothing asks for frames', count: (r) => r.rafs, max: 0 },
  { scenario: 'idle', step: 'rest', says: 'at rest, nothing lays out', count: (r) => r.layouts, max: 0 },
];
