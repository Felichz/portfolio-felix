/*
 * Portfolio bridge, inlined at the top of each vendored app's index.html (scripts/apps/vendor.mjs).
 * Inert unless the app runs inside the portfolio's thaw frame (src/scripts/thaw.ts), which leaves a
 * `__thaw` handoff on its window before creating the frame. Then, before any of the app's code runs:
 * - the clock continues from the recorded moment the preview froze on, so times and running timers
 *   match the frame the visitor was looking at;
 * - once the app has painted its first screen, the portfolio is told, so it can swap the preview for
 *   the live app without a visible seam.
 * The app's own state (localStorage) was already seeded by the portfolio, same origin.
 */
(function () {
  var handoff;
  try {
    handoff = window.parent !== window && window.parent.__thaw;
  } catch (e) {}
  if (!handoff || handoff.app !== document.currentScript.dataset.app) return;

  // ---- Clock: recorded time at the checkpoint, advancing in real time from the moment it was reached.
  var RealDate = Date;
  var offset = handoff.clock - handoff.real;
  var now = function () {
    return RealDate.now() + offset;
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
