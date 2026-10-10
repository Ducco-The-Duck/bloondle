// Pure game rules, no DOM, so they can be tested in Node.

export const MAX_GUESSES = 6;

export const upgradeId = (u) => `${u.tower}|${u.name}`;

/** Compare a guess against the answer. Numeric clues say which way the answer lies. */
export function compare(guess, answer) {
  const dir = (g, a) => (g === a ? "correct" : a > g ? "higher" : "lower");
  return {
    tower: guess.tower === answer.tower ? "correct" : "wrong",
    category: guess.category === answer.category ? "correct" : "wrong",
    path: guess.path === answer.path ? "correct" : "wrong",
    tier: dir(guess.tier, answer.tier),
    cost: dir(guess.cost, answer.cost),
  };
}

export const isWin = (clues) => Object.values(clues).every((c) => c === "correct");

/** Small deterministic string hash (cyrb53) so everyone gets the same daily answer. */
export function hash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** UTC date key, e.g. "2026-10-10". */
export const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export function dailyAnswer(upgrades, key = dayKey()) {
  return upgrades[hash(`bloondle:${key}`) % upgrades.length];
}

export function randomAnswer(upgrades, rand = Math.random) {
  return upgrades[Math.floor(rand() * upgrades.length)];
}

const EMOJI = { correct: "🟩", wrong: "🟥", higher: "🔼", lower: "🔽" };

export function shareText(label, guesses, answer) {
  const won = guesses.length > 0 && guesses[guesses.length - 1].id === upgradeId(answer);
  const header = `Bloondle ${label} ${won ? guesses.length : "X"}/${MAX_GUESSES}`;
  const rows = guesses.map((g) =>
    ["tower", "category", "path", "tier", "cost"].map((k) => EMOJI[g.clues[k]]).join(""),
  );
  return [header, ...rows].join("\n");
}
