

export const N = 4;
export const K = 4;
export const CELLS = N ** 4;

export const toIndex = (x, y, w, z) => ((x * N + y) * N + w) * N + z;
export const fromIndex = i => [
    Math.floor(i / (N * N * N)) % N,
    Math.floor(i / (N * N)) % N,
    Math.floor(i / N) % N,
    i % N,
];

export const LINES = (() => {
    const dirs = [];
    for (let code = 0; code < 3 ** N; code++) {
        let rest = code;
        const v = [];
        for (let i = 0; i < N; i++) { v.push((rest % 3) - 1); rest = Math.floor(rest / 3); }
        const first = v.find(x => x !== 0);
        if (first === undefined || first < 0) continue;
        dirs.push(v);
    }
    const out = [];
    for (let start = 0; start < CELLS; start++) {
        const c = fromIndex(start);
        for (const dir of dirs) {
            const end = c.map((x, i) => x + dir[i] * (K - 1));
            if (!end.every(v => v >= 0 && v < N)) continue;
            const line = [];
            for (let k = 0; k < K; k++) line.push(toIndex(...c.map((x, i) => x + dir[i] * k)));
            out.push(line);
        }
    }
    return out;
})();

export const LINES_BY_CELL = (() => {
    const acc = Array.from({ length: CELLS }, () => []);
    LINES.forEach((line, li) => line.forEach(c => acc[c].push(li)));
    return acc.map(a => Int32Array.from(a));
})();

export class Position {
    constructor(board) {
        this.b = Uint8Array.from(board);
        this.c1 = new Int8Array(LINES.length);
        this.c2 = new Int8Array(LINES.length);
        LINES.forEach((line, li) => {
            for (const c of line) {
                if (this.b[c] === 1) this.c1[li]++;
                else if (this.b[c] === 2) this.c2[li]++;
            }
        });
    }
    place(i, player) {
        this.b[i] = player;
        const counts = player === 1 ? this.c1 : this.c2;
        for (const li of LINES_BY_CELL[i]) counts[li]++;
    }
    lift(i) {
        const player = this.b[i];
        if (!player) return;
        this.b[i] = 0;
        const counts = player === 1 ? this.c1 : this.c2;
        for (const li of LINES_BY_CELL[i]) counts[li]--;
    }
    marks() {
        let m = 0;
        for (let i = 0; i < CELLS; i++) if (this.b[i]) m++;
        return m;
    }
    hasLine(player) {
        const mine = player === 1 ? this.c1 : this.c2;
        const theirs = player === 1 ? this.c2 : this.c1;
        for (let li = 0; li < LINES.length; li++) if (mine[li] === K && theirs[li] === 0) return true;
        return false;
    }

    winCells(player) {
        const mine = player === 1 ? this.c1 : this.c2;
        const theirs = player === 1 ? this.c2 : this.c1;
        const out = new Set();
        for (let li = 0; li < LINES.length; li++) {
            if (mine[li] !== K - 1 || theirs[li] !== 0) continue;
            for (const c of LINES[li]) if (this.b[c] === 0) { out.add(c); break; }
        }
        return out;
    }

    relevant(player) {
        const mine = player === 1 ? this.c1 : this.c2;
        const theirs = player === 1 ? this.c2 : this.c1;
        const out = new Set();
        for (let li = 0; li < LINES.length; li++) {
            if (theirs[li] !== 0 || mine[li] < K - 2) continue;
            for (const c of LINES[li]) if (this.b[c] === 0) out.add(c);
        }
        return out;
    }
    empties() {
        const out = [];
        for (let i = 0; i < CELLS; i++) if (this.b[i] === 0) out.push(i);
        return out;
    }
}


export function winInOneMoves(pos, mover) {
    return [...pos.winCells(mover)];
}


export function winInThreeMoves(pos, mover) {
    const defender = 3 - mover;
    const out = [];
    if (pos.winCells(mover).size > 0) return out; // already win-in-1
    for (const a of pos.relevant(mover)) {
        pos.place(a, mover);
        if (!pos.hasLine(mover) && pos.winCells(mover).size >= 2 && pos.winCells(defender).size === 0) {
            out.push(a);
        }
        pos.lift(a);
    }
    return out;
}

export function winInFiveMoves(pos, mover) {
    const defender = 3 - mover;
    const out = [];
    if (pos.winCells(mover).size > 0) return out;
    if (winInThreeMoves(pos, mover).length > 0) return out; // it is a faster win
    for (const a of pos.relevant(mover)) {
        pos.place(a, mover);
        let ok = false;
        if (!pos.hasLine(mover) && pos.winCells(defender).size === 0) {
            const threats = [...pos.winCells(mover)];
            if (threats.length === 1) {
                pos.place(threats[0], defender);
                if (!pos.hasLine(defender)) {
                    ok = pos.winCells(mover).size > 0 || winInThreeMoves(pos, mover).length > 0;
                }
                pos.lift(threats[0]);
            }
        }
        pos.lift(a);
        if (ok) out.push(a);
    }
    return out;
}

export function forcingWins(pos, mover, halfMoves) {
    if (halfMoves === 1) return winInOneMoves(pos, mover);
    if (halfMoves === 3) return winInThreeMoves(pos, mover);
    if (halfMoves === 5) return winInFiveMoves(pos, mover);
    throw new Error(`unsupported half-move count ${halfMoves}`);
}


export function proveWinInThree(pos, mover, move) {
    const defender = 3 - mover;
    pos.place(move, mover);
    let ok = !pos.hasLine(mover);
    if (ok) {
        for (const d of pos.empties()) {
            pos.place(d, defender);
            const bad = pos.hasLine(defender) || pos.winCells(mover).size === 0;
            pos.lift(d);
            if (bad) { ok = false; break; }
        }
    }
    pos.lift(move);
    return ok;
}


export function proveWinInFive(pos, mover, move) {
    const defender = 3 - mover;
    pos.place(move, mover);
    let ok = !pos.hasLine(mover) && pos.winCells(defender).size === 0;
    if (ok) {
        for (const d of pos.empties()) {
            pos.place(d, defender);
            let good = false;
            if (!pos.hasLine(defender)) {
                if (pos.winCells(mover).size > 0) good = true;
                else {
                    for (const a of winInThreeMoves(pos, mover)) {
                        if (proveWinInThree(pos, mover, a)) { good = true; break; }
                    }
                }
            }
            pos.lift(d);
            if (!good) { ok = false; break; }
        }
    }
    pos.lift(move);
    return ok;
}
