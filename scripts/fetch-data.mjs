// Pulls BTD6 upgrade data from the Bloons Wiki (Cargo tables) into data/upgrades.json.
// Usage: node scripts/fetch-data.mjs   (set NODE_USE_ENV_PROXY=1 if you're behind a proxy)
import { writeFile, mkdir, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const API = "https://www.bloonswiki.com/api.php";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "upgrades.json");
const ICON_DIR = join(ROOT, "icons");
const run = promisify(execFile);
// Icons render at <=56px, so shrink to 112px (2x) when ImageMagick is available.
const shrink = (p) => run("convert", [p, "-resize", "112x112>", "-strip", p]).catch(() => {});

async function cargo(tables, fields, where = "") {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const url = new URL(API);
    url.search = new URLSearchParams({
      action: "cargoquery", format: "json", tables, fields, where,
      limit: "500", offset: String(offset),
    });
    const res = await fetch(url, { headers: { "User-Agent": "bloondle-data-fetch" } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    const page = json.cargoquery.map((r) => r.title);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

// Wiki markup in descriptions -> plain text.
const clean = (s) =>
  s.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1").replace(/'{2,}/g, "").replace(/<[^>]+>/g, "")
   .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").trim();

const towers = await cargo("btd6_towers", "name,category,cost");
const category = new Map(towers.filter((t) => t.cost).map((t) => [t.name, t.category]));

const rows = await cargo(
  "btd6_upgrades",
  "tower,name,icon,description,cost,path,tier",
  "unused=0 AND path>0 AND tier>=1 AND tier<=5",
);

const upgrades = rows
  .filter((r) => category.has(r.tower) && r.cost !== "")
  .map((r) => ({
    name: r.name,
    tower: r.tower,
    category: category.get(r.tower),
    path: Number(r.path),
    tier: Number(r.tier),
    cost: Number(r.cost),
    icon: r.icon,
    description: clean(r.description),
  }))
  .sort((a, b) => a.tower.localeCompare(b.tower) || a.path - b.path || a.tier - b.tier);

// Guesses are looked up by name, so names must be unique across towers.
const seen = new Map();
for (const u of upgrades) {
  if (seen.has(u.name)) console.warn(`Duplicate name "${u.name}": ${seen.get(u.name)} / ${u.tower}`);
  seen.set(u.name, u.tower);
}

// Icons: resolve real URLs via imageinfo (Special:FilePath is blocked), download any we don't have yet.
const files = [...new Set(upgrades.map((u) => u.icon).filter(Boolean))];
const urls = new Map();
for (let i = 0; i < files.length; i += 50) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query", format: "json", prop: "imageinfo", iiprop: "url",
    titles: files.slice(i, i + 50).map((f) => `File:${f}`).join("|"),
  });
  const json = await (await fetch(url, { headers: { "User-Agent": "bloondle-data-fetch" } })).json();
  const renamed = new Map((json.query.normalized ?? []).map((n) => [n.to, n.from]));
  for (const page of Object.values(json.query.pages)) {
    const title = page.title.replace(/^File:/, "");
    const from = (renamed.get(page.title) ?? page.title).replace(/^File:/, "");
    const info = page.imageinfo?.[0];
    if (info) urls.set(from, info.url); else console.warn(`No image found for ${title}`);
  }
}
await mkdir(ICON_DIR, { recursive: true });
const localName = (f) => f.replaceAll(" ", "_");
const exists = (p) => access(p).then(() => true, () => false);
let downloaded = 0;
for (const [file, src] of urls) {
  const dest = join(ICON_DIR, localName(file));
  if (await exists(dest)) continue;
  const res = await fetch(src, { headers: { "User-Agent": "bloondle-data-fetch" } });
  if (!res.ok) { console.warn(`Icon ${file}: ${res.status}`); urls.delete(file); continue; }
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  await shrink(dest);
  downloaded++;
}
for (const u of upgrades) u.icon = urls.has(u.icon) ? localName(u.icon) : null;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), upgrades }, null, 1) + "\n");
console.log(`Wrote ${upgrades.length} upgrades from ${category.size} towers to ${OUT}; downloaded ${downloaded} icons`);
