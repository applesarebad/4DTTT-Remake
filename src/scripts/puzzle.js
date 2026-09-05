import * as game from "./game.js"
import * as single from "./single.js"
import * as daily from "./daily.js"
import * as stats from "./stats.js"


const DATA = "/puzzles.json"

let corpus = null
let entry = null
let day = 0
let budget = 0
let remaining = 0
let outcome = null

export { dayNumber, label, streak } from "./daily.js"

export async function fetchCorpus() {
    if (corpus) return corpus
    const res = await fetch(DATA)
    if (!res.ok) throw new Error(`could not load ${DATA}: ${res.status}`)
    corpus = await res.json()
    return corpus
}


export function puzzleFor(dayNo) {
    const i = ((dayNo % corpus.length) + corpus.length) % corpus.length
    return corpus[i]
}

function record(result) {
    daily.record(day, result)
    reportOutcome(result)
}

function reportOutcome(result) {
    if (!stats.enabled()) return
    const used = budget - remaining
    stats.report(day, result, used).then(s => {
        const line = stats.summary(s)
        const slot = document.getElementById("yourturnmsg")
        if (slot && line) slot.innerHTML = line
    })
}

function clearStatsLine() {
    const slot = document.getElementById("yourturnmsg")
    if (slot) slot.innerHTML = ""
}

function moveWord(k) {
    return k === 1 ? "1 move" : `${k} moves`
}

const hooks = {
    id: () => entry.id ?? `day-${day}`,

    status() {
        if (outcome === "solved") return "Solved!"
        if (outcome === "failed") return "Out of moves"
        if (remaining === budget) return `Win in ${moveWord(budget)}`
        return `${moveWord(remaining)} left`
    },

    onPlayerMove() {
        remaining -= 1
    },

    endMessage(playerWon) {
        outcome = playerWon ? "solved" : "failed"
        record(outcome)
        return playerWon ? "Solved!" : "Puzzle failed"
    },

        onSettled() {
        if (game.isGameover()) return
        if (remaining > 0) return
        outcome = "failed"
        record("failed")
        game.endGame()
        document.getElementById("turnmsg").innerHTML = "Out of moves"
    },
}

export function begin(now = new Date()) {
    day = daily.dayNumber(now)
    entry = puzzleFor(day)
    budget = Math.ceil(entry.w / 2)
    remaining = budget
    outcome = null
    clearStatsLine()

    game.setPuzzle(hooks)
    game.singleInit(2, entry.t)
    single.setSeed(0x4d77 ^ day)
    game.loadPosition(Array.from(entry.b, c => Number(c)), entry.t)
    return entry
}

export function current() {
    return { day, entry, budget, remaining, outcome }
}
