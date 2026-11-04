/**
 * The picture on the 3D phone's screen: the shot under a drawn status bar. Drawn on the page, not in
 * phone-worker.ts, because the status bar is set in the page's font, which a worker doesn't have.
 */
// The screen texture: a 390 x 844 pt screen at 3x, the top 47 pt being the drawn status bar.
export const TW = 1170;
export const TH = 2532;
const BAR = 141;

/** The status bar is drawn, not captured: the app runs in a browser, which has none. */
export function drawScreen(img: HTMLImageElement, darkSite: boolean) {
  const c = new OffscreenCanvas(TW, TH);
  const g = c.getContext('2d')!;
  // Its colors follow the edition on screen, the opposite of the site's theme.
  const fg = darkSite ? '#111318' : '#f4f5f7';
  const mid = BAR * 0.55;
  g.fillStyle = darkSite ? '#f3f4f6' : '#15171c';
  g.fillRect(0, 0, TW, BAR);
  g.drawImage(img, 0, BAR, TW, TH - BAR);
  g.fillStyle = fg;
  g.font = `600 50px ${getComputedStyle(document.body).fontFamily}`;
  g.textBaseline = 'middle';
  g.fillText('9:41', 128, mid);
  g.fillStyle = '#000';
  g.beginPath();
  g.roundRect(TW / 2 - 182, 30, 364, 104, 52);
  g.fill();
  g.fillStyle = fg;
  [24, 32, 42, 52].forEach((h, i) => {
    g.beginPath();
    g.roundRect(860 + i * 16, mid + 26 - h, 11, h, 3);
    g.fill();
  });
  g.strokeStyle = fg;
  g.lineWidth = 6;
  for (const r of [10, 22, 34]) {
    g.beginPath();
    g.arc(950, mid + 22, r, -Math.PI * 0.75, -Math.PI * 0.25);
    g.stroke();
  }
  g.globalAlpha = 0.45;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(1000, mid - 18, 70, 36, 10);
  g.stroke();
  g.globalAlpha = 1;
  g.beginPath();
  g.roundRect(1007, mid - 11, 48, 22, 5);
  g.fill();
  return c.transferToImageBitmap();
}
