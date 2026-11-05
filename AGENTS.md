<!-- frameproof:start -->
## Performance: frameproof

This project measures frames with frameproof. Before changing anything for performance, run
`npx -y github:Felichz/FrameProof next` and do what it says; `npx -y github:Felichz/FrameProof guide` has the manual for the installed
version. Read `perf/GOALS.md` (what matters, and what isn't traded away) and `perf/JOURNAL.md` (what was
tried) first. Judge a change only with `frameproof compare`, and report `inconclusive` as "not known",
never as "no difference". Don't open trace files or write parsers: ask `frameproof query`.
<!-- frameproof:end -->
