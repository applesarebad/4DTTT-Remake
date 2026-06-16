import * as game from "./game.js"
import {boxes, n, d} from "./game.js"

let allLines = []


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


export function singleInit(){
    getAllLines()
}
export function computerMove() {

}

export function getBest() {

}
export function scoreBoard(turn) {
    let opp = 3 - turn
    let moveScores = {}
    for (let box of game.allboxes()) {
        if (box.state === null) {
            moveScores[box.el.dataset.pos] = 0
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
                moveScores[key] += mine.length**2
                if(mine.length == n-1){
                    moveScores[key] += 1000000
                }
            }
        }
        else if(mine.length == 0){
            for(let e of empty){
                let key = e.join(',')
                moveScores[key] += theirs.length**2
                if(theirs.length == n-1){
                    moveScores[key] += 100000
                }
            }
        }
        
    }
    return moveScores

}
export function getTop(turn, x) {
    const scores = scoreBoard(turn)
    return Object.entries(scores)
        .sort((a, b) => b[1] - a[1])
        .slice(0, x)
        .map(([key]) => key.split(',').map(Number))
}

function sim(x, y, w, z, turn) {
    boxes[x][y][w][z].state = turn
}
function unsim(x, y, w, z) {
    boxes[x][y][w][z].state = null
}

