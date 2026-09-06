
// Set PUBLIC_STATS_API to the deployed worker's origin before `npm run build`.
// Unset — the default — disables the feature outright and no request is made.
const API = (import.meta.env?.PUBLIC_STATS_API ?? "").replace(/\/$/, "")

const ID_KEY = "4dttt:client"
const TIMEOUT_MS = 4000

export const enabled = () => API !== ""

export function clientId() {
    try {
        let id = localStorage.getItem(ID_KEY)
        if (!id) {
            id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
                .replace(/[^A-Za-z0-9_-]/g, "")
            localStorage.setItem(ID_KEY, id)
        }
        return id
    } catch (e) {
        return null
    }
}

async function call(path, init) {
    if (!enabled()) return null
    try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
        const res = await fetch(`${API}${path}`, { ...init, signal: ctrl.signal })
        clearTimeout(timer)
        if (!res.ok) return null
        return await res.json()
    } catch (e) {
        return null
    }
}

export function fetchStats(day) {
    return call(`/api/stats?day=${encodeURIComponent(day)}`)
}

export function report(day, outcome, moves, hinted) {
    const id = clientId()
    if (!id) return Promise.resolve(null)
    return call("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, outcome, moves, hinted: !!hinted, clientId: id }),
    })
}

export function summary(stats) {
    if (!stats) return ""
    const parts = []
    if (stats.rate !== null && stats.rate !== undefined) {
        parts.push(`${Math.round(stats.rate * 100)}% solved it`)
        // Only worth saying when it differs; otherwise nobody used the hint and
        // the two numbers would read as a mistake.
        if (stats.unaidedRate !== null && stats.unaidedRate !== undefined &&
            Math.round(stats.unaidedRate * 100) !== Math.round(stats.rate * 100)) {
            parts.push(`${Math.round(stats.unaidedRate * 100)}% without the hint`)
        }
    }
    if (stats.position) parts.push(`you were ${ordinal(stats.position)}`)
    return parts.join(" · ")
}

export function ordinal(n) {
    const rem100 = n % 100
    if (rem100 >= 11 && rem100 <= 13) return `${n}th`
    switch (n % 10) {
        case 1: return `${n}st`
        case 2: return `${n}nd`
        case 3: return `${n}rd`
        default: return `${n}th`
    }
}
