/**
 * The "lite" mode (first tried on origin/lite-experiment, 05043c8): off by default, so the site ships
 * as designed. On, a preview's window opens and closes at once, without its morph (as with reduced
 * motion), and the deck's sections out of sight keep their style and layout while the window is open
 * or the theme switches (global.css, [data-lite]).
 *
 * Turn it on for everyone here, or for one visit with `?lite` in the URL (`?lite=0` turns it off).
 */
export let lite = false;

try {
  const q = new URLSearchParams(location.search).get('lite');
  if (q !== null) lite = q !== '0';
  if (lite) document.documentElement.setAttribute('data-lite', '');
} catch {
  // No location (a build step): the default stands.
}
