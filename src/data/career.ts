/** Career start, from the résumé: Device Magic, December 2020. */
const START = { year: 2020, month: 12 };

const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/**
 * Time in frontend, as of the build date. Rounds honestly: "nearly six" from 9 months short of a
 * full year, otherwise the completed years with a plus.
 */
export function experience(now = new Date()) {
  const months = (now.getFullYear() - START.year) * 12 + (now.getMonth() + 1 - START.month);
  const full = Math.floor(months / 12);
  const nearly = months % 12 >= 9;
  const n = nearly ? full + 1 : full;
  const word = words[n] ?? String(n);
  return {
    /** "Nearly six years" / "Five years" (sentence case, for copy). */
    phrase: `${nearly ? 'Nearly ' + word : word[0]!.toUpperCase() + word.slice(1)} years`,
    /** "Nearly 6 years" / "5+ years" (for small labels). */
    label: nearly ? `Nearly ${n} years` : `${n}+ years`,
  };
}
