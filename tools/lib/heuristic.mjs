
import { Position, CELLS, LINES, N } from "./solver.mjs";

export function moveScores(board, turn) {
    const opp = 3 - turn;
    const sc = new Float64Array(CELLS).fill(-1);
    for (let i = 0; i < CELLS; i++) if (board[i] === 0) sc[i] = 0;
    for (const line of LINES) {
        let mine = 0, theirs = 0;
        const empty = [];
        for (const i of line) {
            const v = board[i];
            if (v === 0) empty.push(i);
            else if (v === turn) mine++;
            else theirs++;
        }
        if (theirs === 0) {
            for (const e of empty) { sc[e] += mine ** 3 + 1; if (mine === N - 1) sc[e] += 1e9; }
        } else if (mine === 0) {
            for (const e of empty) { sc[e] += theirs ** 3; if (theirs === N - 1) sc[e] += 5e7; }
        }
    }
    return sc;
}

export function rankOf(board, turn, cell) {
    const sc = moveScores(board, turn);
    let better = 0;
    for (let i = 0; i < CELLS; i++) if (sc[i] > sc[cell] && board[i] === 0) better++;
    return better;
}


export function metrics(board, me, sol, halfMoves) {
    const opp = 3 - me;
    const pos = new Position(board);
    let decoys = 0, realForks = 0, singles = 0;
    for (const i of pos.relevant(me)) {
        pos.place(i, me);
        const mine = pos.winCells(me).size;
        const theirs = pos.winCells(opp).size;
        if (pos.hasLine(me)) { /* immediate win, not a fork */ }
        else if (mine >= 2 && theirs === 0) realForks++;
        else if (mine >= 2) decoys++;
        else if (mine === 1) singles++;
        pos.lift(i);
    }
    return {
        marks: pos.marks(),
        rank: rankOf(pos.b, me, sol),
        oppThreat: pos.winCells(opp).size > 0,
        decoys, realForks, singles, halfMoves,
    };
}

export function interest(m) {
    if (m.oppThreat) return 0;           // the first move is forced; not a puzzle
    let s = 0;
    s += Math.min(m.rank, 30) * 5;       // how far from obvious the answer is
    s += m.halfMoves === 5 ? 90 : 0;         // needs a preparatory move, not just a fork
    s += Math.min(m.singles, 16) * 3;    // plausible near-misses to sift through
    s += Math.max(0, 45 - m.marks) * 2;  // a board you can take in at a glance
    return s;
}
