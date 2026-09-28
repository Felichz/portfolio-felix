import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, UIEvent } from 'react';
import './RowsDemo.css';

/**
 * A re-creation of the technique, with synthetic data: filter 100,000 table rows
 * against their formatted, displayed values without blocking the main thread.
 * "Progressive" scans in ~6 ms slices, yields to the browser between slices and
 * renders matches as they arrive. "Blocking" does the same work in one go.
 */

const TOTAL = 100_000;
const ROW_H = 36;
const VIEW_H = 432;
const SLICE_MS = 6;
const COLUMNS = ['Device', 'Status', 'SSID', 'Access point', 'IP address', 'MAC', 'Usage (24 h)', 'Last seen'];

interface Row {
  device: string;
  online: boolean;
  ssid: string;
  ap: string;
  ip: string;
  mac: string;
  bytes: number;
  seenSecondsAgo: number;
}

type Mode = 'progressive' | 'blocking';

// ---------------------------------------------------------------- data

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MODELS = ['iPhone-15', 'iPhone-13', 'Galaxy-S24', 'Pixel-9', 'MacBook-Pro', 'MacBook-Air', 'ThinkPad-X1', 'Surface-Pro', 'iPad-Air', 'Chromebook', 'Zebra-TC52', 'Polycom-VVX', 'Echo-Show', 'HP-LaserJet', 'Dell-XPS', 'Moto-G84'];
const SSIDS = ['Corp', 'Corp-5G', 'Guest', 'IoT', 'Lab', 'Warehouse', 'Voice'];
const WINGS = ['East', 'West', 'North', 'South', 'Lab'];
const HEX = '0123456789ABCDEF';

function hex(rand: () => number, n: number) {
  let s = '';
  for (let i = 0; i < n; i++) s += HEX[(rand() * 16) | 0];
  return s;
}

function makeRow(rand: () => number): Row {
  const vlan = 10 + ((rand() * 40) | 0);
  const seen = rand() < 0.62 ? (rand() * 280) | 0 : (rand() * 604_800) | 0;
  const bytes = Math.round(Math.exp(rand() * 9.5 + 11)); // ~60 kB to ~800 GB, log spread
  return {
    device: `${MODELS[(rand() * MODELS.length) | 0]}-${hex(rand, 4)}`,
    online: seen < 300,
    ssid: SSIDS[(rand() * SSIDS.length) | 0]!,
    ap: `AP-${1 + ((rand() * 9) | 0)}F-${WINGS[(rand() * WINGS.length) | 0]}-${String(1 + ((rand() * 40) | 0)).padStart(2, '0')}`,
    ip: `10.${vlan}.${(rand() * 255) | 0}.${1 + ((rand() * 253) | 0)}`,
    mac: Array.from({ length: 6 }, () => hex(rand, 2)).join(':'),
    bytes,
    seenSecondsAgo: seen,
  };
}

// ---------------------------------------------------------------- display formatting

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const relFmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'short' });
const intFmt = new Intl.NumberFormat('en-US');

function formatBytes(b: number) {
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (b >= 1000 && i < units.length - 1) {
    b /= 1000;
    i++;
  }
  return `${numberFmt.format(b)} ${units[i]}`;
}

function formatSeen(s: number) {
  if (s < 60) return relFmt.format(-s, 'second');
  if (s < 3600) return relFmt.format(-Math.round(s / 60), 'minute');
  if (s < 86_400) return relFmt.format(-Math.round(s / 3600), 'hour');
  return relFmt.format(-Math.round(s / 86_400), 'day');
}

/** Match against what the user actually sees in the cells, like a real table filter. */
function matches(r: Row, q: string) {
  const text = `${r.device} ${r.online ? 'online' : 'offline'} ${r.ssid} ${r.ap} ${r.ip} ${r.mac} ${formatBytes(r.bytes)} ${formatSeen(r.seenSecondsAgo)}`;
  return text.toLowerCase().includes(q);
}

// ---------------------------------------------------------------- scheduling

type SchedulerLike = { yield?: () => Promise<void> };

function yieldToMain(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: SchedulerLike }).scheduler;
  if (scheduler?.yield) return scheduler.yield();
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });
}

// ---------------------------------------------------------------- component

interface Scan {
  scanned: number;
  found: number;
  firstMs: number | null;
  totalMs: number | null;
}

const IDLE: Scan = { scanned: TOTAL, found: TOTAL, firstMs: null, totalMs: null };

export default function RowsDemo() {
  const rowsRef = useRef<Row[] | null>(null);
  const resultRef = useRef<number[] | null>(null); // null = no filter, show everything
  const jobRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>('progressive');
  const [query, setQuery] = useState('');
  const [scan, setScan] = useState<Scan>(IDLE);
  const [, setVersion] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Generate the rows in slices too; a demo about long tasks shouldn't open with one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rand = mulberry32(20_210_801);
      const rows: Row[] = new Array(TOTAL);
      let i = 0;
      while (i < TOTAL) {
        const start = performance.now();
        while (i < TOTAL && performance.now() - start < SLICE_MS) {
          for (let k = 0; k < 500 && i < TOTAL; k++, i++) rows[i] = makeRow(rand);
        }
        await yieldToMain();
        if (cancelled) return;
      }
      rowsRef.current = rows;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const bump = () => setVersion((v) => v + 1);

  const runBlocking = useCallback((q: string) => {
    const rows = rowsRef.current!;
    const t0 = performance.now();
    const out: number[] = [];
    for (let i = 0; i < TOTAL; i++) if (matches(rows[i]!, q)) out.push(i);
    const ms = performance.now() - t0;
    resultRef.current = out;
    setScan({ scanned: TOTAL, found: out.length, firstMs: ms, totalMs: ms });
    bump();
  }, []);

  const runProgressive = useCallback(async (q: string) => {
    const job = ++jobRef.current;
    const rows = rowsRef.current!;
    const t0 = performance.now();
    const out: number[] = [];
    resultRef.current = out;
    let firstMs: number | null = null;
    let i = 0;
    setScan({ scanned: 0, found: 0, firstMs: null, totalMs: null });
    bump();
    while (i < TOTAL) {
      const start = performance.now();
      while (i < TOTAL && performance.now() - start < SLICE_MS) {
        for (let k = 0; k < 128 && i < TOTAL; k++, i++) if (matches(rows[i]!, q)) out.push(i);
      }
      if (firstMs === null && out.length > 0) firstMs = performance.now() - t0;
      setScan({ scanned: i, found: out.length, firstMs, totalMs: i >= TOTAL ? performance.now() - t0 : null });
      bump();
      await yieldToMain();
      if (job !== jobRef.current) return; // a newer keystroke replaced this scan
    }
  }, []);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    const q = value.trim().toLowerCase();
    jobRef.current++;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    setScrollTop(0);
    if (!q) {
      resultRef.current = null;
      setScan(IDLE);
      bump();
      return;
    }
    if (mode === 'blocking') runBlocking(q);
    else void runProgressive(q);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    const q = query.trim().toLowerCase();
    jobRef.current++;
    if (!q || !rowsRef.current) return;
    if (next === 'blocking') runBlocking(q);
    else void runProgressive(q);
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => setScrollTop(e.currentTarget.scrollTop);

  // ---------------------------------------------------------- virtual window
  const count = resultRef.current ? resultRef.current.length : ready ? TOTAL : 0;
  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const last = Math.min(count, Math.ceil((scrollTop + VIEW_H) / ROW_H) + 4);
  const visible: { index: number; row: Row }[] = [];
  if (rowsRef.current) {
    for (let v = first; v < last; v++) {
      const index = resultRef.current ? resultRef.current[v]! : v;
      visible.push({ index, row: rowsRef.current[index]! });
    }
  }

  const progress = scan.scanned / TOTAL;
  const scanning = query.trim() !== '' && scan.totalMs === null;

  return (
    <div className="rd" data-mode={mode}>
      <div className="rd-toolbar">
        <label className="rd-search">
          <span className="visually-hidden">Filter 100,000 clients</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={onChange}
            placeholder={ready ? 'Filter clients, try “guest”' : 'Generating 100,000 rows…'}
            disabled={!ready}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="rd-modes" role="group" aria-label="Filtering strategy">
          <button type="button" aria-pressed={mode === 'progressive'} onClick={() => switchMode('progressive')}>
            Progressive
          </button>
          <button type="button" aria-pressed={mode === 'blocking'} onClick={() => switchMode('blocking')}>
            Blocking
          </button>
        </div>
      </div>

      <div className="rd-stats" aria-live="polite" aria-atomic="true">
        <Stat label="Matches" value={ready ? intFmt.format(scan.found) : '0'} />
        <Stat label="Scanned" value={`${Math.round(progress * 100)}%`} bar={progress} busy={scanning} />
        <Stat label="First results" value={scan.firstMs === null ? '–' : `${Math.max(1, Math.round(scan.firstMs))} ms`} />
        <Stat label="Full scan" value={scan.totalMs === null ? (scanning ? '…' : '–') : `${Math.round(scan.totalMs)} ms`} />
        <FrameMeter />
      </div>

      <div className="rd-table" role="table" aria-label="Network clients (synthetic data)" aria-rowcount={count + 1}>
        <div className="rd-scroll" ref={bodyRef} onScroll={onScroll} tabIndex={0}>
          <div className="rd-head" role="row" aria-rowindex={1}>
            {COLUMNS.map((c) => (
              <span role="columnheader" key={c}>
                {c}
              </span>
            ))}
          </div>
          <div className="rd-body" style={{ height: Math.max(count, 1) * ROW_H }} role="rowgroup">
            {visible.map(({ index, row }, i) => (
              <div
                className="rd-row"
                role="row"
                aria-rowindex={first + i + 2}
                key={index}
                style={{ transform: `translateY(${(first + i) * ROW_H}px)` }}
              >
                <span role="cell" className="rd-device">{row.device}</span>
                <span role="cell">
                  <i className={row.online ? 'rd-dot on' : 'rd-dot'} aria-hidden="true" />
                  {row.online ? 'Online' : 'Offline'}
                </span>
                <span role="cell">{row.ssid}</span>
                <span role="cell">{row.ap}</span>
                <span role="cell" className="rd-num">{row.ip}</span>
                <span role="cell" className="rd-num rd-mac">{row.mac}</span>
                <span role="cell" className="rd-num rd-right">{formatBytes(row.bytes)}</span>
                <span role="cell" className="rd-num rd-right">{formatSeen(row.seenSecondsAgo)}</span>
              </div>
            ))}
            {ready && count === 0 && !scanning && <p className="rd-empty">No clients match “{query.trim()}”.</p>}
            {!ready && <p className="rd-empty">Generating 100,000 rows in small slices…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, bar, busy }: { label: string; value: string; bar?: number; busy?: boolean }) {
  return (
    <div className="rd-stat">
      <span className="rd-stat-label">{label}</span>
      <span className="rd-stat-value">{value}</span>
      {bar !== undefined && (
        <span className="rd-bar" data-busy={busy ? '' : undefined}>
          <span style={{ transform: `scaleX(${bar})` }} />
        </span>
      )}
    </div>
  );
}

/** Frames per second plus a strip of the last 64 frame times. Long frames show up as tall bars. */
function FrameMeter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState(60);
  const [worst, setWorst] = useState(16);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const W = 128;
    const H = 30;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const frames: number[] = [];
    let last = performance.now();
    let raf = 0;
    let tick = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(canvas);
    const style = getComputedStyle(canvas);
    const ok = style.getPropertyValue('--ok').trim() || '#8a8a92';
    const slow = style.getPropertyValue('--slow').trim() || '#f5a524';
    const bad = style.getPropertyValue('--bad').trim() || '#ff6b5b';

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (visible) {
        frames.push(dt);
        if (frames.length > 64) frames.shift();
        ctx.clearRect(0, 0, W, H);
        const bw = W / 64;
        frames.forEach((f, i) => {
          const h = Math.max(2, Math.min(H, (f / 100) * H));
          ctx.fillStyle = f > 50 ? bad : f > 20 ? slow : ok;
          ctx.fillRect(i * bw, H - h, bw - 0.6, h);
        });
        if (++tick % 15 === 0) {
          const recent = frames.slice(-30);
          const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
          setFps(Math.min(120, Math.round(1000 / avg)));
          setWorst(Math.round(Math.max(...frames)));
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div className="rd-stat rd-fps">
      <span className="rd-stat-label">Frame rate</span>
      <span className="rd-stat-value">
        {fps} fps <small>worst {worst} ms</small>
      </span>
      <canvas ref={canvasRef} className="rd-frames" style={{ width: 128, height: 30 }} aria-hidden="true" />
    </div>
  );
}
