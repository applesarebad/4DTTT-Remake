
import { Position, CELLS, forcingWins } from "./solver.mjs";
import { rankOf } from "./heuristic.mjs";


function solutionStillWins(pos, me, sol, halfMoves) {
    const opp = 3 - me;
    if (pos.b[sol] !== 0) return false;
    if (pos.winCells(me).size > 0) return false;
    pos.place(sol, me);
    let ok = false;
    if (!pos.hasLine(me) && pos.winCells(opp).size === 0) {
        const threats = pos.winCells(me);
        if (halfMoves === 3) {
            ok = threats.size >= 2;
        } else if (threats.size === 1) {
            const t = [...threats][0];
            pos.place(t, opp);
            ok = !pos.hasLine(opp) &&
                (pos.winCells(me).size > 0 || forcingWins(pos, me, 3).length > 0);
            pos.lift(t);
        }
    }
    pos.lift(sol);
    return ok;
}

function stillAPuzzle(pos, me, sol, halfMoves) {
    if (pos.winCells(me).size > 0) return false;
    const wins = forcingWins(pos, me, halfMoves);
    return wins.length === 1 && wins[0] === sol;
}


function guide(pos, me, sol) {
    return rankOf(pos.b, me, sol);
}


export function thin(board, me, sol, halfMoves, { target = 0.6, attempts = 200, widen = 10, rankFloor = 2, rnd = Math.random } = {}) {
    const pos = new Position(board);
    const floor = Math.round(pos.marks() * target);

    while (pos.marks() > floor) {
        const xs = [], os = [];
        for (let i = 0; i < CELLS; i++) {
            if (pos.b[i] === 1) xs.push(i);
            else if (pos.b[i] === 2) os.push(i);
        }
        if (!xs.length || !os.length) break;
        let best = null, bestScore = -Infinity, kept = 0;
        for (let attempt = 0; attempt < attempts && kept < widen; attempt++) {
            const a = xs[Math.floor(rnd() * xs.length)];
            const b = os[Math.floor(rnd() * os.length)];
            if (a === sol || b === sol) continue;
            pos.lift(a); pos.lift(b);
            if (pos.winCells(3 - me).size === 0 &&
                solutionStillWins(pos, me, sol, halfMoves) &&
                stillAPuzzle(pos, me, sol, halfMoves) &&
                rankOf(pos.b, me, sol) >= rankFloor) {
                kept++;
                const score = guide(pos, me, sol);
                if (score > bestScore) { bestScore = score; best = [a, b]; }
            }
            pos.place(a, 1); pos.place(b, 2);
        }
        if (!best) break;
        pos.lift(best[0]);
        pos.lift(best[1]);
    }
    return pos.b;
}
