export const EPOCH = Date.UTC(2026, 8, 5)
const DAY = 86400000

export function dayNumber(now = new Date()) {
    const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    return Math.floor((local - EPOCH) / DAY)
}

export function label(now = new Date()) {
    return now.toLocaleDateString(undefined, { month: "long", day: "numeric" })
}

const key = dayNo => `4dttt:puzzle:${dayNo}`

export function resultFor(dayNo) {
    try {
        return localStorage.getItem(key(dayNo))
    } catch (e) {
        return null
    }
}

export function record(dayNo, result) {
    try {
        if (result === "solved" || localStorage.getItem(key(dayNo)) === null) {
            localStorage.setItem(key(dayNo), result)
        }
    } catch (e) {
        
    }
}

export function streak(today = dayNumber()) {
    let day = resultFor(today) === "solved" ? today : today - 1
    let n = 0
    while (resultFor(day) === "solved") {
        n++
        day--
    }
    return n
}
