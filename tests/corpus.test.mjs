

import fs from "node:fs";
import {
    Position, CELLS, forcingWins, proveWinInThree, proveWinInFive,
} from "../tools/lib/solver.mjs";

const corpus = JSON.parse(fs.readFileSync("public/puzzles.json", "utf8"));

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log(`  FAIL ${msg}`); } };

console.log(`public/puzzles.json — ${corpus.length} puzzles`);

let shapeBad = 0, parityBad = 0, alreadyWon = 0, freeWin = 0, notUnique = 0, notProved = 0;
const markCounts = [];

for (let i = 0; i < corpus.length; i++) {
    const e = corpus[i];
    const where = `day ${i}`;

    if (typeof e.b !== "string" || e.b.length !== CELLS || /[^012]/.test(e.b)) { shapeBad++; continue; }
    if (![1, 2].includes(e.t)) { shapeBad++; continue; }
    if (![3, 5].includes(e.w)) { shapeBad++; continue; }
    if ("s" in e) { shapeBad++; console.log(`  FAIL ${where}: the solution cell must not be shipped to the client`); continue; }

    const board = Uint8Array.from(e.b, c => Number(c));
    markCounts.push(board.reduce((n, v) => n + (v ? 1 : 0), 0));

    // A position must be reachable under real turn order.
    const x = board.reduce((n, v) => n + (v === 1 ? 1 : 0), 0);
    const o = board.reduce((n, v) => n + (v === 2 ? 1 : 0), 0);
    const expected = x === o ? 1 : x === o + 1 ? 2 : 0;
    if (expected !== e.t) { parityBad++; console.log(`  FAIL ${where}: X=${x} O=${o} but toMove=${e.t}`); }

    const pos = new Position(board);
    if (pos.hasLine(1) || pos.hasLine(2)) { alreadyWon++; console.log(`  FAIL ${where}: position already contains a completed line`); continue; }
    if (pos.winCells(e.t).size > 0) { freeWin++; console.log(`  FAIL ${where}: player already has an immediate win`); continue; }

    const wins = forcingWins(pos, e.t, e.w);
    if (wins.length !== 1) {
        notUnique++;
        console.log(`  FAIL ${where}: expected exactly one forcing win, found [${wins}]`);
        continue;
    }
    const sol = wins[0];
    const proved = e.w === 3 ? proveWinInThree(pos, e.t, sol) : proveWinInFive(pos, e.t, sol);
    if (!proved) { notProved++; console.log(`  FAIL ${where}: exhaustive-defender proof failed`); }
}

check(shapeBad === 0, `${shapeBad} entries are malformed`);
check(parityBad === 0, `${parityBad} positions are unreachable under real turn order`);
check(alreadyWon === 0, `${alreadyWon} positions already contain a line`);
check(freeWin === 0, `${freeWin} positions hand the player a free win`);
check(notUnique === 0, `${notUnique} solutions are not the unique forcing win`);
check(notProved === 0, `${notProved} positions failed the exhaustive proof`);

const med = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(`   every position re-proved against an exhaustive defender`);
console.log(`   marks: median ${med(markCounts)}, min ${Math.min(...markCounts)}, max ${Math.max(...markCounts)}`);
console.log(`   ${corpus.filter(e => e.w === 5).length} three-move, ${corpus.filter(e => e.w === 3).length} two-move\n`);

console.log(failures === 0 ? "ALL TESTS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
