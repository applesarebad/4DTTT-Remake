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
let statsLine = ""
let revealed = false

// The hint is withheld until the day has been failed this many times. It is
// for someone genuinely stuck, not a first resort.
const HINT_AFTER = 5

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
    if (result === "failed") daily.noteFail(day)
    reportOutcome(result)
    renderSlot()
}

function reportOutcome(result) {
    if (!stats.enabled()) return
    const used = budget - remaining
    stats.report(day, result, used, daily.usedHint(day)).then(s => {
        statsLine = stats.summary(s)
        renderSlot()
    })
}

/**
 * The turn-indicator slot is written from here and nowhere else. The hint
 * button and the solve-rate line both want it and they arrive at different
 * times, so rendering from state is what stops the later one erasing the other.
 */
function renderSlot() {
    const slot = document.getElementById("yourturnmsg")
    if (!slot) return
    const parts = []
    if (statsLine) parts.push(`<span class="text-xl">${statsLine}</span>`)
    if (!revealed && outcome !== "solved" && daily.fails(day) >= HINT_AFTER) {
        parts.push(
            `<span id="showsolution" class="bg-purple-300 text-purple-900 text-xl font-bold px-4 py-2 rounded-sm hover:bg-purple-400 cursor-pointer">show first move</span>`
        )
    }
    slot.innerHTML = parts.join("<br>")
    const btn = document.getElementById("showsolution")
    if (btn) btn.addEventListener("click", revealFirstMove, { once: true })
}

/**
 * Outlines the winning first move and nothing else. The rest of the line is
 * still the player's to find, and using this is recorded so the solve rate can
 * say how many people got there unaided.
 */
function revealFirstMove() {
    revealed = true
    daily.noteHint(day)
    const n = 4
    const i = entry.s
    const el = game.get(
        Math.floor(i / (n * n * n)) % n,
        Math.floor(i / (n * n)) % n,
        Math.floor(i / n) % n,
        i % n
    )
    // An inset shadow, not an outline: an outline is painted outside the cell's
    // box and cells later in DOM order paint over the part that spills into
    // them, so the mark kept disappearing behind its neighbours. This is the
    // same technique the winning-line highlight uses, and it cannot be covered.
    if (el) el.style.boxShadow = "inset 0 0 0 4px purple"
    renderSlot()
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
    statsLine = ""
    revealed = false

    game.setPuzzle(hooks)
    game.singleInit(2, entry.t)
    single.setSeed(0x4d77 ^ day)
    game.loadPosition(Array.from(entry.b, c => Number(c)), entry.t)
    renderSlot()
    return entry
}

export function current() {
    return { day, entry, budget, remaining, outcome }
}
