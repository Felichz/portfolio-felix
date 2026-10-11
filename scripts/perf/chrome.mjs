// Where the measuring scripts find Chrome, on each machine. CHROME_PATH overrides the search.
import { existsSync } from 'node:fs';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

export function chromePath() {
  const found = process.env.CHROME_PATH || CANDIDATES.find(existsSync);
  if (!found) throw new Error('Chrome not found: install Google Chrome, or set CHROME_PATH to its executable.');
  return found;
}
