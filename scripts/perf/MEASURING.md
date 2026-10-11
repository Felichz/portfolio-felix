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

## Two machines

Two Claude instances measure here, one per machine (see CLAUDE.md). The numbers of one machine are never compared with the other's: the displays, GPUs and loads differ. Each keeps its own baseline, `scripts/perf/baseline-<agent>.md`, written with the commands below, and every A/B runs on one machine. `node scripts/perf/ceiling.mjs` shows what a blank page holds on a screen: set `DISPLAY_HZ` to it. The table under Baseline is `win`'s.

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

## Found by elimination (same-process origin, 2026-10-10)

Product change on `[::1]`, injected CSS, two alternations of two rounds each (switch.mjs). Median fps and share of the second in hitches:

| Variant | fps | hitches |
|---|---|---|
| base | 90 | 14–16% |
| `.stage-frame` hidden (`display: none`) | 100 | 0% |
| `.stage-frame` hidden (`visibility`) | 96 | 9% |
| `tape-player` hidden | 100 | 0% |
| `.plate` shadow off | 91 | 14% |
| `.slide-media` transition off | 90 | 15% |
| `.ambient` / cursor glow off | 88 | 19% |

So the cost of a product change in one process is the product's own stage: its tape playing and the app booting under it, both on the page's main thread (the trace attributes ~100 ms of JavaScript in the second, all in the app's bundle). The slide's CSS isn't it.

- **DWELL 300 instead of 600** (the app boots sooner): worse on the product change, 86–87 fps and 15–20% against 90–91 fps and 12–14%, three alternations each. Rejected. It would only shorten the hover to live by about 50 ms.
  The gate on the same origin, three alternations, IDS=lifeui: hover to live 299, 318, 362 ms at 600 against 318, 304, 358 ms at 300 (no median gain), and the hover phase's hitches 5.5–6.2% at 600 against 5.6–9.7% at 300. Rejected on both.
- **Window opening and scroll** show no cost on this 100 Hz panel: scroll holds 100 fps with 0% hitches at both origins, and the gate's window phases hold 100 fps with 0%. Nothing there to eliminate here.

Left for a decision, because each changes something visible: play the tape only after the app is booted, or boot the app later than the second after a click (a longer DWELL trades the hover to live for a calmer click).
