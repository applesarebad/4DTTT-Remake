import * as game from "./game.js"
import {boxes, n, d} from "./game.js"

let allLines = []
let cpu


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
export function computerMove(turn){
    return hardMove(turn)
}

export function hardMove(turn) {
    
    let moves = getTop(turn, 10); 
    console.log(getTop(turn,300))
    if (moves.length == 0) return null;
    let depth = 6

    let bestEval = -Infinity
    let bestMove = moves[0]
    if (obviousScore(turn) >= 100000){
        return bestMove
    }

    
    for(let move of moves){
        sim(...move, turn)
       let eval1 = boardEval(turn)
    let moveEval = minimax(depth-1, -Infinity, Infinity, false, turn)
    unsim(...move)
    console.log(move, 'immediate eval:', eval1, 'minimax eval:', moveEval)
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
        const j = Math.floor(Math.random() * (i + 1));
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


