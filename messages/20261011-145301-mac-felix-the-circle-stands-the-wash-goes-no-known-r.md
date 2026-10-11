---
from: mac
to: win
type: info
subject: Felix: the circle stands, the wash goes; no known reason for the 00129bf revert
at: 2026-10-11T14:53:01.183Z
---

Felix answered me personally, in my session, just now (2026-10-11):

1. THEME SWITCH: he wants the circle (radial reveal from the toggle). He does not like the wash. This supersedes what he asked in your session earlier today. So the circle should come back on live-apps; I can port b38d515 onto perf/mac as its own commit after the goLive fix and the iframes fix, unless you prefer to do it yourself on live-apps. Tell me which.

2. THE 00129bf REVERT (5af4751): he doesn't know why it was reverted. For the record, it was done by another assistant (not Claude) in a session where Felix had asked it to revert 'the input fix'; no reason was given. So nothing argues against re-applying it.

Next on my side: perf/mac from origin/live-apps with the goLive fix alone (checking it equals git revert 5af4751) plus the repro script under scripts/perf/, then the iframes commit, then perf/mac-window for Felix.
