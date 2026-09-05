import * as game from "./game.js"
import {boxes, n, d} from "./game.js"

let allLines = []
let cpu


let rng = Math.random
export function setSeed(seed) {
    if (seed === null) {
        rng = Math.random
        return
    }
    let a = seed >>> 0
    rng = () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}


export function getAllLines(){
    allLines = []
    let seen = new Set()
    for (let x = 0; x < n; x++){
        for (let y = 0; y < n; y++){
            for (let w = 0; w < n; w++){
                for (let z = 0; z < n; z++) {
                    for (let line of game.checkPossibleLines([x, y, w, z])) {
                        if (line.some(p => game.boxes[p[0]][p[1]][p[2]][p[3]].el?.style.display === 'none')) continue
                        const key = line.map(p => p.join(',')).sort().join('|')
                        if (seen.has(key)) continue
                        seen.add(key)
                        allLines.push(line)
                    }}}}}
}


export function singleInit(computer){
    cpu = computer
    getAllLines()
}

export function winningCells(player) {
    const opp = 3 - player
    const out = []
    const seen = new Set()
    for (const line of allLines) {
        let mine = 0, theirs = 0, gap = null
        for (const p of line) {
            const v = game.getState(...p)
            if (v === player) mine++
            else if (v === opp) { theirs++; break }
            else gap = p
        }
        if (theirs > 0 || mine !== n - 1 || gap === null) continue
        const key = gap.join(',')
        if (!seen.has(key)) { seen.add(key); out.push(gap) }
    }
    return out
}


function threatTally(player) {
    const opp = 3 - player
    const tally = new Map()
    for (const line of allLines) {
        let mine = 0, theirs = 0
        const empty = []
        for (const p of line) {
            const v = game.getState(...p)
            if (v === player) mine++
            else if (v === opp) { theirs++; break }
            else empty.push(p)
        }
        if (theirs > 0 || mine !== n - 2) continue
        for (const e of empty) {
            const key = e.join(',')
            tally.set(key, (tally.get(key) ?? 0) + 1)
        }
    }
    return tally
}

const cellsWithAtLeast = (tally, k) =>
    [...tally].filter(([, count]) => count >= k).map(([key]) => key.split(',').map(Number))

export function forkCells(player) {
    return cellsWithAtLeast(threatTally(player), 2)
}

function pickBest(cells, turn) {
    if (cells.length <= 1) return cells[0] ?? null
    const scores = moveFinder(turn)
    let best = cells[0], bestScore = -Infinity
    for (const c of cells) {
        const s = scores[c.join(',')] ?? -Infinity
        if (s > bestScore) { bestScore = s; best = c }
    }
    return best
}
export function forcedMove(turn) {
    const opp = 3 - turn

    const mine = winningCells(turn)
    if (mine.length) return pickBest(mine, turn)

    const theirs = winningCells(opp)
    if (theirs.length) return pickBest(theirs, turn)

    const myForks = forkCells(turn)
    if (myForks.length) return pickBest(myForks, turn)

    const tally = threatTally(opp)
    const theirForks = cellsWithAtLeast(tally, 2)
    if (theirForks.length === 1) return theirForks[0]
    if (theirForks.length > 1) {
        const counter = cellsWithAtLeast(threatTally(turn), 1)
        if (counter.length) return pickBest(counter, turn)
        return pickBest(theirForks, turn)
    }
    return null
}

export function computerMove(turn){
    if (cpu == 1) return EasyMove(turn)
    else if (cpu ==2) return MedMove(turn)
    else return hardMove(turn)
}
export function EasyMove(turn){
    let possible = getTop(turn, 20)
    if (obviousScore(turn) >= 1000){
        if (rng() >= 0.2){
            return possible[0]
        }
    }
    return possible[Math.floor(rng()*possible.length)]
}
export function MedMove(turn) {
    return forcedMove(turn) ?? getTop(turn, 1)[0]
}
export function hardMove(turn) {

    const forced = forcedMove(turn)
    if (forced) return forced

    let moves = getTop(turn, 7);
    if (moves.length == 0) return null;
    
    let depth = 6
    if(d==4 && n >= 5){
        depth = 4
    }
    if(d==3 && n <= 4){
        depth = 8
    }
    if(d==2){
        depth = 10
    }



    let bestEval = -Infinity
    let bestMove = moves[0]
    if (obviousScore(turn) >= 100000){
        return bestMove
    }

    
    for(let move of moves){
        sim(...move, turn)
        let moveEval = minimax(depth-1, -Infinity, Infinity, false, turn)
        unsim(...move)
        if (moveEval > bestEval){
            bestEval = moveEval
            bestMove = move
        }
    }
    return bestMove
}

export function minimax(depth, a, b, memaxing, myturn){

    let currentScore = boardEval(myturn)

    if (currentScore >= 100000000 || currentScore <= -100000000) {
        return currentScore
    }

    if(depth == 0) return currentScore

    let currturn = memaxing ? myturn : 3-myturn
    let moves = getTop(currturn, 5)
    
    //all moves done
    if(moves.length == 0) return 0


    if(memaxing){
        let maxEval = -Infinity
        for(let move of moves){
            sim(...move, currturn)
            let moveEval = minimax(depth-1, a,b, !memaxing, myturn)
            unsim(...move)
            maxEval = Math.max(maxEval, moveEval)
            
            
            a = Math.max(a, maxEval)
            if(b <= a) break;
            
        }
        return maxEval
    }
    else{
        //themmining
        let minEval = Infinity
        for(let move of moves){
            sim(...move, currturn)
            let moveEval = minimax(depth-1, a,b, !memaxing, myturn)
            unsim(...move)
            minEval = Math.min(minEval, moveEval)

            
            b = Math.min(b, minEval)
            if(b <= a) break;
            
        }
        return minEval
    }
}

export function boardEval(turn){
    let opp = 3 - turn
    let score = 0
    let mefork = 0
    let themfork = 0
    

    for(let line of allLines){
        let mine = 0
        let theirs = 0
        let empty = 0
        for(let i of line){
            switch(game.getState(...i)){
                case null: empty+=1; break
                case turn: mine+=1; break
                case opp: theirs+=1; break
            }
        }

        if(mine == n) return 9990000000000
        if(theirs == n) return -10000000000
        
        if(theirs == 0){
            score += mine**2
            if(mine == n-1){
                mefork += 1
            }
        }
        else if(mine == 0){
            score -= theirs**4
            if(theirs == n-1){
                themfork+=1 
            }
        }
    }
    if (mefork >= 2) score += 100000
    if (themfork >=2) score -= 100000
    return score
}
export function moveFinder(turn) {
    let opp = 3 - turn
    let moveScores = {}
    for (let box of game.allboxes()) {
        if (box.state === null) {
            if (box.el?.style.display === 'none') continue;
            const [x, y, w, z] = box.el.dataset.pos.split(',').map(Number)
            const key = `${x},${y},${w},${z}` 
            moveScores[key] = 0
        }
    }

    for(let line of allLines){
        let mine = []
        let theirs = []
        let empty = []
        for(let i of line){
            switch(game.getState(...i)){
                case null: empty.push(i); break
                case turn: mine.push(i); break
                case opp: theirs.push(i); break
            }
        }
        if(theirs.length == 0){
            for(let e of empty){
                let key = e.join(',')
                moveScores[key] += mine.length**3 + 1 
                if(mine.length == n-1){
                    moveScores[key] += 1000000000
                }
            }
        }
        else if(mine.length == 0){
            for(let e of empty){
                let key = e.join(',')
                moveScores[key] += theirs.length**3
                if(theirs.length == n-1){
                    moveScores[key] += 50000000
                }
            }
        }
        
    }
    return moveScores

}
export function getTop(turn, x) {
    let entries = Object.entries(moveFinder(turn));
    if (entries.length === 0) return [];

    for (let i = entries.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    
    entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

    if ((entries[0][1] ?? -1) === -1) {
        return [];
    }

    return entries.slice(0, x).map(([key]) => key.split(',').map(Number));
}

export function obviousScore(turn){
    let entries = Object.entries(moveFinder(turn))
    entries = entries
        .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
    return entries[0][1]
}

function sim(x, y, w, z, turn) {
    boxes[x][y][w][z].state = turn
}
function unsim(x, y, w, z) {
    boxes[x][y][w][z].state = null
}
