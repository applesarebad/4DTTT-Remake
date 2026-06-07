
export { }

let n = 5
let d = 4
let turn = 1
let gameover = false
let prevCoord = null
let boxes = []
let board = null
let wmult = 1

export function init(size, dim) {

    turn = 1
    gameover = false
    prevCoord = null
    boxes = []
    n = size
    d = dim
    wmult = (n <= 3 || d <= 2) ? 2 : 1

    board = document.getElementById('board')
    boxes = Array.from({ length: n }, () =>
        Array.from({ length: n }, () =>
            Array.from({ length: n }, () =>
                Array.from({ length: n }, () => ({
                    state: null,
                    el: null
                }))
            )
        )
    )

    document.querySelectorAll('.cell').forEach(el => {
        el.className = "cell bg-white aspect-square rounded-sm";
        const [x, y, w, z] = el.dataset.pos.split(',').map(Number)
        boxes[x][y][w][z].el = el
    })
    turnsetup()
}

export function turnsetup(){
        document.getElementById("turnmsg").innerHTML = turn === 1 ? `X's turn` : `O's turn`
        animation(document.getElementById("turn"),turn)
        document.getElementById("all").style.backgroundColor = turn === 1 ? "#ffcccc" : "#ccccff"
    
}

export function get(x, y, w, z) {
    return boxes[x][y][w][z].el
}

export function getState(x, y, w, z) {
    return boxes[x][y][w][z]?.state ?? null
}

export function setState(x, y, w, z, value) {
    boxes[x][y][w][z].state = value
}

export function allboxes(){
    let all = []
    for(let i of boxes){
        for(let j of i){
            for(let k of j){
                for(let l of k){
                    all.push(l)
                }
            }
        }
    }
    return all
}

export function onClick(x, y, w, z) {
    //ignore when its not good inptu
    if (gameover) return
    if (getState(x, y, w, z) !== null) return

    //actual change 
    setState(x, y, w, z, turn)
    const cell = get(x, y, w, z)
    onUnhover()
    claimCell(x, y, w, z, turn)

    //swithciugn the border
    if (prevCoord != null) get(...prevCoord).style.outline = "none"
    prevCoord = [x, y, w, z]
    get(...prevCoord).style.outline = turn === 1 ? `${2 * wmult}px solid red` : `${2 * wmult}px solid blue`

    wincheck(x,y,w,z)
    
    if(gameover) return
    turn = turn === 1 ? 2 : 1
    turnsetup()
}

export function wincheck(x,y,w,z){
     const lines = checkPossibleLines([x, y, w, z])
    for (const line of lines) {
        const states = line.map(p => getState(...p))
        if (states.every(s => s === states[0] && s !== null)) {
            gameover = true
            for (const point of line) {
                const el = get(...point)
                if (el) el.style.boxShadow = turn === 1 ? `inset 0 0 0 4000px red` : `inset 0 0 0 4000px blue`
                get(...prevCoord).style.outline = turn === 1 ? `${2 * wmult}px solid purple` : `${2 * wmult}px solid purple`
                get(...prevCoord).style.border = turn === 1 ? `${3 * wmult}px solid purple` : `${2 * wmult}px solid purple`
            }
            document.getElementById("turnmsg").innerHTML = `player ${turn} wins!`
            return
        }
    }
}
export function claimCell(x, y, w, z, player) {
    const el = get(x, y, w, z)
    const img = document.createElement('img')
    img.src = `/${player === 1 ? 'X' : 'O'}/0.png`
    img.style.width = '100%'
    img.style.height = '100%'
    img.style.pointerEvents = 'none'
    el.appendChild(img)

    animation(img, player)
}

export function animation(el, n){
    let frame = 0
    const interval = setInterval(() => {
        frame++
        if (frame >= 7) {
            clearInterval(interval)
            return
        }
        el.src = `/${n === 1 ? 'X' : 'O'}/${frame}.png`
    }, 40) 
}
export function onHover(x, y, w, z) {
    onUnhover()
    console.log(turn)
    const lines = checkPossibleLines([x, y, w, z])
    const COLOURS = ['#ff8888', '#8888ff']
    let colour = turn === 1
        ? COLOURS[0] : COLOURS[1]
    if (getState(x, y, w, z) !== null) colour = COLOURS[getState(x, y, w, z) - 1]
    lines.forEach((line) => {

        for (const point of line) {
            const el = get(...point)
            el.style.background = colour
        }
        get(x, y, w, z).style.background = colour
    })
}

export function onUnhover() {
    for(let b of allboxes()){
        b.el.style.background = "white"
    }
}

export function reset() {
    boxes = {}
    turn = 1
    gameover = false
    prevCoord = null
    document.querySelectorAll('.cell').forEach(el => {
        el.style.background = 'white'
        el.style.outline = ''
    })
}

function checkPossibleLines(coord) {
    const lines = []
    for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
            for (let k = -1; k <= 1; k++)
                for (let l = -1; l <= 1; l++) {
                    if (i === 0 && j === 0 && k === 0 && l === 0) continue
                    const line = []
                    for (let m = -(n - 1); m < n; m++) {
                        const nx = m * i + coord[0]
                        const ny = m * j + coord[1]
                        const nw = m * k + coord[2]
                        const nz = m * l + coord[3]
                        if (nx >= 0 && nx < n && ny >= 0 && ny < n && nw >= 0 && nw < n && nz >= 0 && nz < n) {
                            line.push([nx, ny, nw, nz])
                        }
                    }
                    if (line.length === n) lines.push(line)
                }


    const unique = []
    const seen = new Set()
    for (const line of lines) {
        const key = [...line].map(p => p.join(',')).sort().join('|')
        if (!seen.has(key)) { seen.add(key); unique.push(line) }
    }
    return unique
}