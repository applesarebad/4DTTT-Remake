// Builds public/puzzles.json — the daily rotation the site serves.
//
// Pipeline:
//   pool      the sampled positions
//   thin      strip marks the tactic does not need, difficulty-guided
//   measure   score each puzzle for how much of a puzzle it actually is
//   dedupe    drop positions too close to one already chosen
//   select    take the best, keeping a share of the deeper three-move ones
//   order     lay them out so similar puzzles never land in the same fortnight
//
// Re-run with `npm run puzzles`. Sampling is separate and much slower — see
// tools/sample-puzzles.mjs — so this reads its output rather than redoing it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Position, CELLS, forcingWins, proveWinInThree, proveWinInFive } from "./lib/solver.mjs";
import { metrics, interest } from "./lib/heuristic.mjs";
import { thin } from "./lib/thin.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLED = path.join(root, "tools", "sampled.json");
const THINNED = path.join(root, "tools", "thinned.json");
const OUT = path.join(root, "public", "puzzles.json");

const WANT = 400;          // days of rotation to ship
// Two puzzles closer than this many differing cells are treated as the same
// puzzle. It has to scale with how sparse the boards are: thinned positions
// carry a median of ~22 marks, so two of them can differ by at most ~44 cells
// and a threshold tuned for the original 42-mark boards throws away almost
// everything — at 24 only 44 of 395 usable three-move puzzles survived.
const MIN_DISTANCE = 16;
const WINDOW = 14;         // no two similar puzzles inside this many days
const DEEP_SHARE = 0.5;    // at least this fraction should be three-move puzzles

// Thinning is the slow half and depends only on the sampled pool, so its result
// is cached. Pass --rethin after changing anything in lib/thin.mjs.
const RETHIN = process.argv.includes("--rethin");

function mulberry32(a) {
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rndThin = mulberry32(20260001);
const rndOrder = mulberry32(20260002);

// --- pool ------------------------------------------------------------------
if (!fs.existsSync(SAMPLED)) {
    console.error(`missing ${path.relative(root, SAMPLED)} — run "npm run sample" first.`);
    process.exit(1);
}
const pool = JSON.parse(fs.readFileSync(SAMPLED, "utf8")).map(s => ({
    id: s.id,
    board: Uint8Array.from(s.board),
    toMove: s.toMove,
    sol: s.sol,
    halfMoves: s.winInHalfMoves,
}));
console.log(`pool: ${pool.length} positions`);

// --- thin ------------------------------------------------------------------
const started = Date.now();
let thinned = [];
if (!RETHIN && fs.existsSync(THINNED)) {
    thinned = JSON.parse(fs.readFileSync(THINNED, "utf8")).map(t => ({
        ...t, board: Uint8Array.from(t.board, c => Number(c)),
    }));
    console.log(`reusing ${path.relative(root, THINNED)} (${thinned.length} positions) — pass --rethin to redo`);
} else {
    for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        const board = thin(p.board, p.toMove, p.sol, p.halfMoves, { target: 0.6, rnd: rndThin });
        const pos = new Position(board);
        const proved = p.halfMoves === 3
            ? proveWinInThree(pos, p.toMove, p.sol)
            : proveWinInFive(pos, p.toMove, p.sol);
        const wins = forcingWins(pos, p.toMove, p.halfMoves);
        if (!proved || wins.length !== 1 || wins[0] !== p.sol) continue;
        thinned.push({ id: p.id, toMove: p.toMove, sol: p.sol, halfMoves: p.halfMoves, board });
        if ((i + 1) % 1000 === 0) console.log(`  thinned ${i + 1}/${pool.length} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
    }
    fs.writeFileSync(THINNED, JSON.stringify(thinned.map(t => ({ ...t, board: Array.from(t.board).join("") }))));
    console.log(`thinned and re-proved: ${thinned.length} survived`);
}
for (const t of thinned) {
    t.m = metrics(t.board, t.toMove, t.sol, t.halfMoves);
    t.score = interest(t.m);
}

// --- dedupe + select -------------------------------------------------------
function hamming(a, b) {
    let c = 0;
    for (let i = 0; i < CELLS; i++) if (a[i] !== b[i]) c++;
    return c;
}
thinned.sort((a, b) => b.score - a.score);

const TIERS = [
    m => !m.oppThreat && m.rank >= 8,
    m => !m.oppThreat && m.rank >= 4,
    m => !m.oppThreat && m.rank >= 2,
    m => !m.oppThreat && m.rank >= 1,
];

const chosen = [];
const taken = new Set();
const wantDeep = Math.round(WANT * DEEP_SHARE);
let deep = 0;
const tierCount = new Array(TIERS.length).fill(0);

const tryAdd = (cand, tier) => {
    if (taken.has(cand)) return false;
    if (chosen.some(c => hamming(c.board, cand.board) < MIN_DISTANCE)) return false;
    chosen.push(cand);
    taken.add(cand);
    tierCount[tier]++;
    if (cand.halfMoves === 5) deep++;
    return true;
};

const DEEP_TIERS = 2;
for (let t = 0; t < DEEP_TIERS && deep < wantDeep; t++) {
    for (const cand of thinned) {
        if (deep >= wantDeep || chosen.length >= WANT) break;
        if (cand.halfMoves !== 5 || !TIERS[t](cand.m)) continue;
        tryAdd(cand, t);
    }
}
for (let t = 0; t < TIERS.length && chosen.length < WANT; t++) {
    for (const cand of thinned) {
        if (chosen.length >= WANT) break;
        if (!TIERS[t](cand.m)) continue;
        tryAdd(cand, t);
    }
}
console.log(`selected ${chosen.length} (${deep} three-move, ${chosen.length - deep} two-move)`);
console.log(`  by quality tier: ${tierCount.map((c, i) => `T${i}=${c}`).join("  ")}`);

// --- order -----------------------------------------------------------------
// Similar boards and repeated answers must not land in the same fortnight.
const n = chosen.length;
const D = chosen.map(a => chosen.map(b => hamming(a.board, b.board)));
const sameAnswer = chosen.map(a => chosen.map(b => (a.sol === b.sol ? 1 : 0)));
function pen(i, j, gap) {
    const w = (WINDOW + 1 - gap) / WINDOW;
    let s = 0;
    if (D[i][j] < 30) s += (30 - D[i][j]) ** 2 * w;
    if (sameAnswer[i][j]) s += 400 * w;
    return s;
}
let order = chosen.map((_, i) => i);
for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rndOrder() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
}
const localCost = (ord, idx) => {
    let s = 0;
    for (let k = Math.max(0, idx - WINDOW); k <= Math.min(n - 1, idx + WINDOW); k++) {
        if (k !== idx) s += pen(ord[idx], ord[k], Math.abs(idx - k));
    }
    return s;
};
const swapDelta = (ord, i, j) => {
    const gap = Math.abs(i - j);
    const overlap = gap <= WINDOW ? pen(ord[i], ord[j], gap) : 0;
    const before = localCost(ord, i) + localCost(ord, j) - overlap;
    [ord[i], ord[j]] = [ord[j], ord[i]];
    const after = localCost(ord, i) + localCost(ord, j) - (gap <= WINDOW ? pen(ord[i], ord[j], gap) : 0);
    [ord[i], ord[j]] = [ord[j], ord[i]];
    return after - before;
};
for (let T = 3000; T > 0.4; T *= 0.9997) {
    const i = Math.floor(rndOrder() * n), j = Math.floor(rndOrder() * n);
    if (i === j) continue;
    const d = swapDelta(order, i, j);
    if (d < 0 || rndOrder() < Math.exp(-d / T)) [order[i], order[j]] = [order[j], order[i]];
}
for (let pass = 0; pass < 40; pass++) {
    let improved = false;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        if (swapDelta(order, i, j) < 0) { [order[i], order[j]] = [order[j], order[i]]; improved = true; }
    }
    if (!improved) break;
}

// --- write -----------------------------------------------------------------
const slim = order.map(i => {
    const c = chosen[i];
    return { b: Array.from(c.board).join(""), t: c.toMove, s: c.sol, w: c.halfMoves, r: c.m.rank };
});
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(slim));

const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ms = chosen.map(c => c.m);
const adj = order.slice(0, -1).map((_, i) => D[order[i]][order[i + 1]]);
const within = (gap, pred) => {
    let c = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < Math.min(i + gap, n); j++) if (pred(order[i], order[j])) c++;
    return c;
};
const pct = k => `${k} (${(100 * k / n).toFixed(0)}%)`;
console.log(`\nwrote ${path.relative(root, OUT)} — ${n} puzzles, ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
console.log(`  marks                    median ${med(ms.map(m => m.marks))}`);
console.log(`  solution is the #1 move  ${pct(ms.filter(m => m.rank === 0).length)}`);
console.log(`  solution in the top 5    ${pct(ms.filter(m => m.rank < 5).length)}`);
console.log(`  median rank of solution  ${med(ms.map(m => m.rank))}`);
console.log(`  has a losing decoy fork  ${pct(ms.filter(m => m.decoys > 0).length)}`);
console.log(`  opponent threat live     ${pct(ms.filter(m => m.oppThreat).length)}`);
console.log(`  three-move puzzles       ${pct(ms.filter(m => m.halfMoves === 5).length)}`);
console.log(`  consecutive-day distance min ${Math.min(...adj)} of ${CELLS} cells`);
console.log(`  same answer within 7d    ${within(7, (a, b) => sameAnswer[a][b])}`);
console.log(`  near-duplicate within 14d ${within(WINDOW, (a, b) => D[a][b] <= 8)}`);
