#!/bin/sh
# A/B of the round-2 fixes: swap the live.ts and session.ts variants, rebuild, run the queue
# instrument, alternating the order between rounds. Leaves src/ at the after variant (the fixes).
set -e
cd "$(dirname "$0")/../.."
V=scripts/perf/variants
put() {
  cp "$V/live.$1.txt" src/scripts/live.ts
  cp "$V/session.$1.txt" src/scripts/session.ts
  npx astro build >/dev/null 2>&1
  echo "== $1: $(grep -o '_astro/Base[^"]*' dist/index.html | head -1)"
}
run() {
  BASE='http://[::1]:4391' TAG="$1" ROUND="$2" node scripts/perf/queues.mjs
}
put after;  run after 1
put before; run before 1
put before; run before 2
put after;  run after 2
put after
echo "done; src/ left at the after variant"
