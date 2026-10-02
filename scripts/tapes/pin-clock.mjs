// Pins a Node process's clock to a time of day (PIN=15:24), still running: a backend recorded with a
// scene shows the same times as the page, whose clock record.mjs pins the same way.
// Usage: PIN=15:24 node --import ./scripts/tapes/pin-clock.mjs server.js   (or tsx --import ...)
const [h, m] = (process.env.PIN ?? '15:24').split(':').map(Number);
const RealDate = Date;
const day = new RealDate();
day.setHours(h, m, 0, 0);
const offset = day.getTime() - RealDate.now();
class PinnedDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offset);
    else super(...args);
  }
  static now() {
    return RealDate.now() + offset;
  }
}
globalThis.Date = PinnedDate;
