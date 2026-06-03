
export { }

let n = 5
let turn = 1
let gameover = false
let prevCoord = null
let boxes = {} // key: "x,y,w,z" -> { state: null | 1 | 2 }

export function init(size) {
  n = size
  boxes = Array.from({length: n}, () =>
    Array.from({length: n}, () =>
      Array.from({length: n}, () =>
        Array.from({length: n}, () => ({
          state: null,
          el: null
        }))
      )
    )
  )

  document.querySelectorAll('.cell').forEach(el => {
    const [x,y,w,z] = el.dataset.pos.split(',').map(Number)
    boxes[x][y][w][z].el = el
  })
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

export function onClick(x, y, w, z) {
    if (gameover) return
    if (getState(x, y, w, z) !== null) return
    console.log(turn, "switching")

    setState(x, y, w, z, turn)
    prevCoord = [x, y, w, z]

    const cell = get(x, y, w, z)
    onUnhover()
    if (cell) cell.style.background = turn === 1 ? '#ffaaaa' : '#aaaaff'
    claimCell(x,y,w,z, turn)
    console.log(turn, "switching")
    const lines = checkPossibleLines([x, y, w, z])
    for (const line of lines) {
        const states = line.map(p => getState(...p))
        if (states.every(s => s === states[0] && s !== null)) {
            gameover = true
            for (const point of line) {
                const el = get(...point)
                if (el) el.style.outline = '2px solid gold'
            }
            console.log(`player ${turn} wins!`)
            return
        }
    }
    console.log(turn, "switching")
    turn = turn === 1 ? 2 : 1
    console.log(turn, "switching")
}

export function claimCell(x, y, w, z, player) {
  const el = get(x, y, w, z)
  const img = document.createElement('img')
  img.src = `/${player === 1 ? 'X' : 'O'}/0.png`
  img.style.width = '100%'
  img.style.height = '100%'
  img.style.pointerEvents = 'none'
  el.appendChild(img)

  let frame = 1
  const interval = setInterval(() => {
    frame++
    if (frame >= 7) {
      clearInterval(interval)
      return
    }
    img.src = `/${player === 1 ? 'X' : 'O'}/${frame}.png`
  }, 50) // 50ms per frame = 20fps, adjust to taste
}


export function onHover(x, y, w, z) {
    onUnhover()
    console.log(turn)
    const lines = checkPossibleLines([x, y, w, z])
    const COLOURS = ['#ffaaaa', '#aaaaff']
    let colour = turn === 1
        ? COLOURS[0] : COLOURS[1]
    if (getState(x,y,w,z) !== null) colour = COLOURS[getState(x,y,w,z) - 1]
    lines.forEach((line) => {
        
        for (const point of line) {
        const el = get(...point) 
        if (el && getState(...point) === null) el.style.background = colour
    }
    get(x, y, w, z).style.background = colour
})
}

export function onUnhover() {
    document.querySelectorAll('.cell').forEach(el => {
        const pos = el.dataset.pos
        const [x, y, w, z] = pos.split(',').map(Number)
        if (getState(x, y, w, z) === null) el.style.background = 'white'
    })
    // if (prevCoord) {
    //     const el = get(...prevCoord)
    //     if (el) el.style.background = turn === 2 ? '#ffaaaa' : '#aaaaff'
    // }
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