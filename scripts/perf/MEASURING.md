# Measuring the showcase

How to measure the frames of this site, and the numbers to compare against. The rule is one metric, alternated builds, and a machine that is not busy.

## Method

- **A/B, alternated.** Run variant A, then B, then A again. Two alternations and two rounds per run is the minimum; compare medians. Never compare a number from one run against a number from another day.
- **Same metric.** switch.mjs counts the page's own animation frames for the second after each product change. scroll.mjs does the same for a fling. The gate reads the live preview phases. They are not interchangeable: fps from switch.mjs is not the compositor's draw count (switchtrace.mjs gives that).
- **The display sets the ceiling.** A blank page holds the panel's refresh rate when the machine is free. Set `DISPLAY_HZ` to it (240 by default; 100 on this laptop, where the NVIDIA panel is active). The gate refuses to run when a blank page holds less than 90% of it.
- **Two origins, two pictures.**
  - `http://127.0.0.1:PORT` (the local default): stages load from `localhost`, a different site, so each runs in its own process. This is the best case.
  - `http://[::1]:PORT`: the page's own origin, so stages run in the page's process. This is what a visitor gets on a deployment without `PUBLIC_STAGE_ORIGIN`.
- **Attribute before you change.** switchtrace.mjs (CLICK, FLING, THEME, LABEL, JS, COUNTS) splits the renderers, names the JavaScript, and counts the style work. Remove a cost by injected CSS first, measure, and only then change the code.
- **Close what competes.** League, Riot clients or any game left running make the numbers about the game. If the gate says the machine is busy, close it and run again.

## Commands

```bash
node scripts/perf/switch.mjs base            # product change, `ROUNDS=2`; `BASE=` picks the origin
node scripts/perf/scroll.mjs                 # slow scroll down, fling up
DISPLAY_HZ=100 node scripts/perf/check.mjs --gate   # live previews, frame budgets
THEME=1 node scripts/perf/switchtrace.mjs    # the theme wash, by phase
FLING=1 node scripts/perf/switchtrace.mjs    # the fast scroll, by renderer
node scripts/perf/loadtrace.mjs              # the page load's long tasks
node scripts/perf/themeprof.mjs              # the theme toggle's CPU profile
```

## Baseline

Measured 2026-10-10, `dist` built from commit 1f72444, the laptop's 100 Hz panel active.

| Measurement | Same process as the page (`[::1]`) | Stages in their own process (`127.0.0.1`) |
|---|---|---|
| Product change, fps in the second after a click | 89–91 | 96–98 |
| Product change, share of the second in hitches | 17–18% | 3% |
| Scroll, slow down | 100 fps, 0% | 100 fps, 0% |
| Scroll, fast fling up | 98–101 fps, 0–3% | 99–100 fps, 0–2% |
| Gate, arrive | 96 fps, 5.5% hitches | 99 fps, 1.7% |
| Gate, hover | 93 fps, 10% | 100 fps, 0% |
| Gate, use, open, window, close | 100 fps, 0% | 100 fps, 0% |
| Gate, hover to live | 299 ms | 290 ms |
| Gate result | PASS | PASS |

Open, known costs in both: the first boot of a product's app (KatArch on the gate) blocks the page for about 1.7 s, and the theme wash's covered frame runs 100 ms or more under the veil. Neither is fixed.

Earlier reference, on the 240 Hz panel, before the containment: product change 36–43 fps with 71–80% of the second in hitches at HEAD; 100–160 fps with 20–30% after the containment (it is the same measure on a different panel, so compare it only with itself).
