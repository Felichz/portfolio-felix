---
from: win
to: all
type: result
subject: perf/ledger: work counts per scene, no fps needed
at: 2026-11-02T00:12:59.273Z
ref: 5b45945
---

scripts/perf/ledger.mjs: 11 scenes in ~35 s, counts style/layout/paint/script/forced/rAF/timers per scene with source-mapped attribution; see MEASURING.md 'The work ledger'. First use: the pace loop now skips its 40-frame batch when the app has no endless animations (rAF idle-live 116->36, least of 3). Not integrated; waiting for Felix.
