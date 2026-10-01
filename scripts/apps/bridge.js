/*
 * Portfolio bridge, inlined at the top of each vendored app's index.html (scripts/apps/vendor.mjs).
 * Inert unless the app runs inside the portfolio's thaw frame (src/scripts/thaw.ts), which leaves a
 * `__thaw` handoff on its window before creating the frame. Then, before any of the app's code runs, the
 * app's time belongs to the portfolio:
 * - Date reads a clock the portfolio sets: frozen at the checkpoint's recorded moment while the app
 *   boots, moved to each recorded click's moment while the scene's clicks are replayed, and released at
 *   the frame the preview froze on as the app appears, running from there.
 * - setTimeout and setInterval run on that clock. Moving it forward fires what fell due, the way the
 *   recording lived through it (a toast that had time to leave leaves); while it's frozen, nothing
 *   timed fires early.
 * - Once the app has painted its first screen, the portfolio is told.
 * The app's own state (localStorage) was already seeded by the portfolio, same origin.
 */
(function () {
  var handoff;
  try {
    handoff = window.parent !== window && window.parent.__thaw;
  } catch (e) {}
  if (!handoff || handoff.app !== document.currentScript.dataset.app) return;

  // ---- The clock
  var RealDate = Date;
  var base = handoff.clock;
  var realBase = RealDate.now();
  var frozen = true;
  var now = function () {
    return frozen ? base : base + (RealDate.now() - realBase);
  };
  class ShiftedDate extends RealDate {
    constructor() {
      if (arguments.length === 0) super(now());
      else super(...arguments);
    }
    static now() {
      return now();
    }
  }
  // `Date()` called without `new` returns a string.
  window.Date = new Proxy(ShiftedDate, {
    apply: function () {
      return new ShiftedDate().toString();
    },
  });

  // ---- Timers on that clock
  var realSetTimeout = window.setTimeout.bind(window);
  var realClearTimeout = window.clearTimeout.bind(window);
  var timers = new Map();
  var seq = 1e6;
  var schedule = function (t) {
    if (t.real !== null) realClearTimeout(t.real);
    var wait = t.due - now();
    // Frozen time doesn't bring anything due; it waits for the clock to move.
    t.real = frozen && wait > 0 ? null : realSetTimeout(fire, Math.max(0, wait), t);
  };
  var fire = function (t) {
    if (!timers.has(t.id)) return;
    if (t.every) {
      t.due += t.every;
      if (t.due < now()) t.due = now() + t.every;
      schedule(t);
    } else timers.delete(t.id);
    if (typeof t.fn === 'function') t.fn.apply(window, t.args);
  };
  var add = function (fn, delay, args, every) {
    var t = { id: ++seq, fn: fn, args: args, every: every, due: now() + Math.max(0, Number(delay) || 0), real: null };
    timers.set(t.id, t);
    schedule(t);
    return t.id;
  };
  var drop = function (id) {
    var t = timers.get(id);
    if (!t) return;
    if (t.real !== null) realClearTimeout(t.real);
    timers.delete(id);
  };
  window.setTimeout = function (fn, delay) {
    return add(fn, delay, Array.prototype.slice.call(arguments, 2), 0);
  };
  window.setInterval = function (fn, delay) {
    return add(fn, delay, Array.prototype.slice.call(arguments, 2), Math.max(1, Number(delay) || 0));
  };
  window.clearTimeout = window.clearInterval = drop;

  /**
   * Sets the clock to `ms`, frozen or running; moving forward fires whatever fell due on the way. With
   * `tick`, every interval runs once now, so anything that shows the time redraws at the new time.
   */
  handoff.setClock = function (ms, freeze, tick) {
    base = ms;
    realBase = RealDate.now();
    frozen = !!freeze;
    timers.forEach(schedule);
    if (tick)
      timers.forEach(function (t) {
        if (t.every && typeof t.fn === 'function') t.fn.apply(window, t.args);
      });
  };

  // ---- Ready: the first screen is in the DOM, its fonts are loaded, and it has been painted.
  var report = function () {
    document.fonts.ready.then(function () {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          handoff.ready();
        });
      });
    });
  };
  var check = function () {
    if (!document.querySelector(handoff.readySelector)) return false;
    report();
    return true;
  };
  document.addEventListener('DOMContentLoaded', function () {
    if (check()) return;
    var watch = new MutationObserver(function () {
      if (check()) watch.disconnect();
    });
    watch.observe(document.body, { childList: true, subtree: true });
  });
})();
