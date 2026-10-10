import { MAX_GUESSES, pathLabel, compare, isWin, upgradeId, dailyAnswer, randomAnswer, dayKey, shareText } from "./logic.js";

const $ = (id) => document.getElementById(id);

const { upgrades } = await (await fetch("data/upgrades.json")).json();
const byId = new Map(upgrades.map((u) => [upgradeId(u), u]));

// ---- state ---------------------------------------------------------------
// mode "daily" persists per UTC day; mode "practice" is a fresh random answer, kept only in memory.
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
let game;

function startDaily() {
  const key = dayKey();
  const saved = store.get("bloondle:daily");
  const answer = dailyAnswer(upgrades, key);
  const ids = saved?.day === key ? saved.guesses.filter((id) => byId.has(id)) : [];
  game = { mode: "daily", label: key, answer, guesses: ids.map((id) => makeGuess(byId.get(id), answer)) };
}

function startPractice() {
  game = { mode: "practice", label: "practice", answer: randomAnswer(upgrades), guesses: [] };
}

const makeGuess = (u, answer) => ({ id: upgradeId(u), upgrade: u, clues: compare(u, answer) });
const won = () => game.guesses.some((g) => isWin(g.clues));
const over = () => won() || game.guesses.length >= MAX_GUESSES;

function addGuess(u) {
  game.guesses.push(makeGuess(u, game.answer));
  if (game.mode === "daily") store.set("bloondle:daily", { day: game.label, guesses: game.guesses.map((g) => g.id) });
}

// ---- rendering -----------------------------------------------------------
function cell(text, cls, extra = "") {
  const d = document.createElement("div");
  d.className = `cell ${cls}`;
  d.textContent = text;
  if (extra) d.append(extra);
  return d;
}

function icon(u) {
  const img = document.createElement("img");
  img.className = "icon";
  img.alt = "";
  img.loading = "lazy";
  if (!u.icon) return img;
  img.src = `icons/${u.icon}`;
  img.onerror = () => img.remove();
  return img;
}

function renderGuess({ upgrade: u, clues }) {
  const row = document.createElement("div");
  row.className = "grid";
  const name = document.createElement("div");
  name.className = "cell name";
  name.append(icon(u), u.name);
  const arrow = (c) => ({ higher: " 🔼", lower: " 🔽", correct: "" })[c];
  row.append(
    name,
    cell(u.tower, clues.tower),
    cell(u.category, clues.category),
    cell(pathLabel(u), clues.path),
    cell(`${u.tier}${arrow(clues.tier)}`, clues.tier),
    cell(`$${u.cost.toLocaleString()}${arrow(clues.cost)}`, clues.cost),
  );
  return row;
}

function render() {
  $("mode").textContent = game.mode === "daily" ? `Daily · ${game.label}` : "Practice mode";
  const list = $("guesses");
  // Only re-create the newest row so earlier rows don't replay the flip animation.
  while (list.children.length > game.guesses.length) list.lastChild.remove();
  for (let i = list.children.length; i < game.guesses.length; i++) list.append(renderGuess(game.guesses[i]));
  $("remaining").textContent = over() ? "" : `${MAX_GUESSES - game.guesses.length} guesses left`;
  $("input").disabled = $("submit").disabled = over();
  renderEnd();
}

function renderEnd() {
  const el = $("end");
  el.hidden = !over();
  if (!over()) return;
  const a = game.answer;
  const win = won();
  el.replaceChildren();
  const h = document.createElement("h2");
  h.textContent = win ? `Nice! Solved in ${game.guesses.length}/${MAX_GUESSES}` : "Out of guesses";
  const ans = document.createElement("div");
  ans.className = "answer";
  const txt = document.createElement("div");
  txt.innerHTML = "<b></b><br><small></small>";
  txt.querySelector("b").textContent = a.name;
  txt.querySelector("small").textContent = `${a.tower} · ${pathLabel(a)} · Tier ${a.tier} · $${a.cost.toLocaleString()}`;
  ans.append(icon(a), txt);
  const desc = document.createElement("p");
  desc.textContent = a.description;
  const actions = document.createElement("div");
  actions.className = "actions";
  const share = document.createElement("button");
  share.textContent = "Share";
  share.onclick = async () => {
    const text = shareText(game.label, game.guesses, a);
    try { await navigator.clipboard.writeText(text); share.textContent = "Copied!"; }
    catch { prompt("Copy your result:", text); }
  };
  const again = document.createElement("button");
  again.className = "secondary";
  again.textContent = "Play a random one";
  again.onclick = () => { startPractice(); $("guesses").replaceChildren(); render(); $("input").focus(); };
  actions.append(share, again);
  el.append(h, ans, desc, actions);
}

// ---- autocomplete --------------------------------------------------------
let matches = [];
let active = -1;
const input = $("input");
const options = $("options");

function suggest() {
  const q = input.value.trim().toLowerCase();
  const guessed = new Set(game.guesses.map((g) => g.id));
  matches = q
    ? upgrades.filter((u) => !guessed.has(upgradeId(u)) && `${u.name} ${u.tower}`.toLowerCase().includes(q))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)))
        .slice(0, 30)
    : [];
  active = matches.length ? 0 : -1;
  drawOptions();
}

function drawOptions() {
  options.replaceChildren(...matches.map((u, i) => {
    const li = document.createElement("li");
    li.role = "option";
    li.setAttribute("aria-selected", String(i === active));
    const label = document.createElement("span");
    label.textContent = u.name;
    const small = document.createElement("small");
    small.textContent = u.tower;
    li.append(icon(u), label, small);
    li.onmousedown = (e) => { e.preventDefault(); pick(u); };
    return li;
  }));
  options.hidden = !matches.length;
  input.setAttribute("aria-expanded", String(matches.length > 0));
  options.children[active]?.scrollIntoView({ block: "nearest" });
}

function pick(u) {
  if (over()) return;
  input.value = "";
  matches = [];
  drawOptions();
  addGuess(u);
  render();
}

input.addEventListener("input", suggest);
input.addEventListener("blur", () => { matches = []; drawOptions(); });
input.addEventListener("keydown", (e) => {
  if (!matches.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    active = (active + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
    drawOptions();
  } else if (e.key === "Escape") { matches = []; drawOptions(); }
});
$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim().toLowerCase();
  const exact = upgrades.filter((u) => u.name.toLowerCase() === q);
  // Enter picks the highlighted suggestion; typing a unique full name also works.
  const choice = matches[active] ?? (exact.length === 1 ? exact[0] : null);
  if (choice) pick(choice);
});

startDaily();
render();
