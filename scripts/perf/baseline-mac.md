# Baseline: mac (MacBook Pro 13", Intel Core i5 + Iris Plus, Retina 2x, 60 Hz)

Measured 2026-10-11, `dist` built from `724142e` (live-apps). `DISPLAY_HZ=60`: the blank page holds 59.9 fps (ceiling.mjs), and the gate's "machine busy" check needs 90% of that.

Each number is the median of 3 alternated rounds, one machine, the same code.

## Product change (switch.mjs, base variant)

| Origin | fps, 1 s after the click | worst frame | share of the second in hitches |
|---|---|---|---|
| `http://127.0.0.1:4391` (stage in its own process) | 59 (59, 58, 59) | 33 ms | 4% (3, 5, 4) |
| `http://[::1]:4392` (stage in the page's process) | 54 (55, 54, 54) | 50 ms | 12% (9, 12, 12) |

## Note on the hitch column

`scripts/perf/switch.mjs` on `live-apps` computes hitches as `sum(gap > 16.7 ms) / 10`: the sum of whole frame gaps, divided by 10 instead of 1000. It inflates the number tenfold and counts frames that were on time. The numbers above come from a local copy that counts only the excess over 16.7 ms, divided by 1000 ms (`(gap - 16.7)` summed, over 1000). Fix it in the script on `live-apps`; the fps and worst-frame columns are unaffected.

## Not yet measured on this machine

- Scroll (`scroll.mjs`): the 4x CPU finding on win is the reference; the 1x Mac number is still to come.
- Gate (`check.mjs --gate`): on the busy machine it FAILED with a 1.7 s gap at the first mount (katarch). Rerun on a quiet machine before trusting its phases.
- Cold boot (first boot of an app): not measured.

## How to reproduce

```bash
npm ci && npm run build
npx astro preview --host 127.0.0.1 --port 4391      # and --host "::1" --port 4392 in a second terminal
DISPLAY_HZ=60 BASE=http://127.0.0.1:4391 ROUNDS=1 node scripts/perf/switch.mjs base   # repeat 3 times; take the medians
```
