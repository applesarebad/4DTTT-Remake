// Samples new puzzle positions by playing games and testing every position.
//
// The shipped corpus is 256 entries drawn from only 38 game trajectories, which
// is why so many of its puzzles are near-duplicates and why so few of them are
// deceptive — there was never much to choose from. This widens the pool so that
// selection can afford to be picky.
//
// Games are played with the site's own heuristic under a temperature, rather
// than at random: random play produces positions no human game would reach, and
// the point is a puzzle that looks like a game you could have been in. After
// every move the position is tested for a unique forcing win for the side to
// move, which is exactly the property that makes a position a puzzle.
//
// Usage: node tools/sample-puzzles.mjs [games] [outfile]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Position, CELLS, forcingWins, proveWinInThree, proveWinInFive } from "./lib/solver.mjs";
import { moveScores } from "./lib/heuristic.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES = Number(process.argv[2]) || 4000;
const OUT = process.argv[3] || path.join(root, "tools", "sampled.json");

function mulberry32(a) {
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Pick a move from the heuristic's ranking, softened so games diverge.
 * `greed` is the chance of simply taking the best move.
 */
function pickMove(pos, turn, rnd, greed) {
    const sc = moveScores(pos.b, turn);
    const cells = pos.empties();
    if (cells.length === 0) return -1;
    cells.sort((a, b) => sc[b] - sc[a]);
    if (rnd() < greed) return cells[0];
    // Otherwise take from a random good move
    const span = Math.min(cells.length, 6);
    return cells[Math.floor(rnd() * span)];
}

const found = [];
const seen = new Set();
const rnd = mulberry32(0xC0FFEE);
const started = Date.now();
let positionsTested = 0;

for (let g = 0; g < GAMES; g++) {
    const pos = new Position(new Uint8Array(CELLS));
    let turn = 1;
    const greed = 0.45 + rnd() * 0.5;

    for (let move = 0; move < CELLS; move++) {
        if (move >= 8) {
            positionsTested++;
            if (pos.winCells(turn).size === 0) {
                for (const halfMoves of [3, 5]) {
                    const wins = forcingWins(pos, turn, halfMoves);
                    if (wins.length !== 1) continue;
                    const sol = wins[0];
                    const proved = halfMoves === 3
                        ? proveWinInThree(pos, turn, sol)
                        : proveWinInFive(pos, turn, sol);
                    if (!proved) continue;
                    const key = pos.b.join("") + turn;
                    if (seen.has(key)) break;
                    seen.add(key);
                    found.push({
                        id: `sampled#g${g}-p${move}`,
                        board: Array.from(pos.b),
                        toMove: turn,
                        sol,
                        winInHalfMoves: halfMoves,
                    });
                    break;
                }
            }
        }

        const mv = pickMove(pos, turn, rnd, greed);
        if (mv < 0) break;
        pos.place(mv, turn);
        if (pos.hasLine(turn)) break;
        turn = 3 - turn;
    }

    if ((g + 1) % 500 === 0) {
        const secs = ((Date.now() - started) / 1000).toFixed(0);
        console.log(`  ${g + 1}/${GAMES} games, ${found.length} puzzles, ${positionsTested} positions tested (${secs}s)`);
    }
}

fs.writeFileSync(OUT, JSON.stringify(found));
const secs = ((Date.now() - started) / 1000).toFixed(0);
console.log(`\nsampled ${found.length} puzzles from ${GAMES} games in ${secs}s`);
console.log(`  positions tested: ${positionsTested}  yield: ${(100 * found.length / positionsTested).toFixed(2)}%`);
console.log(`  win-in-3: ${found.filter(f => f.winInHalfMoves === 3).length}   win-in-5: ${found.filter(f => f.winInHalfMoves === 5).length}`);
console.log(`  wrote ${path.relative(root, OUT)}`);
