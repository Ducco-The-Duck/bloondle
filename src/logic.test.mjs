import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compare, isWin, dailyAnswer, shareText, upgradeId, MAX_GUESSES } from "./logic.js";

const { upgrades } = JSON.parse(readFileSync(new URL("../data/upgrades.json", import.meta.url)));
const find = (tower, name) => upgrades.find((u) => u.tower === tower && u.name === name);

// Clue direction: arrows point toward the answer.
const crossbow = find("Dart Monkey", "Crossbow");           // path 3, tier 3, 575
const sun = find("Super Monkey", "True Sun God");                  // tier 5, 500000 (checked below)
let c = compare(find("Dart Monkey", "Sharp Shots"), crossbow);
assert.deepEqual(c, { tower: "correct", category: "correct", path: "wrong", tier: "higher", cost: "higher" });
c = compare(sun, crossbow);
assert.equal(c.tier, "lower"); assert.equal(c.cost, "lower"); assert.equal(c.category, "wrong");
assert.ok(isWin(compare(crossbow, crossbow)));
assert.ok(!isWin(c));

// Same-named upgrades on different towers are distinct.
assert.notEqual(upgradeId(find("Ninja Monkey", "Double Shot")), upgradeId(find("Monkey Buccaneer", "Double Shot")));
assert.equal(new Set(upgrades.map(upgradeId)).size, upgrades.length);

// Daily answer is stable per day and varies across days.
assert.equal(dailyAnswer(upgrades, "2026-10-10"), dailyAnswer(upgrades, "2026-10-10"));
const picks = new Set(Array.from({ length: 60 }, (_, i) => upgradeId(dailyAnswer(upgrades, `2026-11-${i}`))));
assert.ok(picks.size > 40, `daily picks look clumped: ${picks.size}/60`);

// Data invariants the UI relies on.
for (const u of upgrades) {
  assert.ok(u.tier >= 1 && u.tier <= 5 && [1, 2, 3].includes(u.path) && u.cost > 0, upgradeId(u));
}

// Share text.
const g = [{ id: upgradeId(sun), clues: compare(sun, crossbow) }, { id: upgradeId(crossbow), clues: compare(crossbow, crossbow) }];
assert.equal(shareText("2026-10-10", g, crossbow), "Bloondle 2026-10-10 2/6\n🟥🟥🟥🔽🔽\n🟩🟩🟩🟩🟩");
assert.equal(MAX_GUESSES, 6);
console.log(`ok (${upgrades.length} upgrades)`);
