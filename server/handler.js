// The solve-rate service, independent of where it runs.
//
// Two endpoints:
//   POST /api/attempt   record how one player did on one day, get the stats back
//   GET  /api/stats     read the stats for a day
//
// Everything host-specific — the D1 binding, wrangler config — lives next door
// in worker.js and d1-store.js. This file only knows about an abstract `store`,
// so moving to another host means writing one adapter rather than rewriting the
// service.
//
// What this deliberately does NOT collect: no timing, and no identity beyond a
// random per-browser id the client makes up for itself. Timing was left out
// because a client-reported clock cannot be trusted, and the moment it is
// stored someone will want to rank by it.

const OUTCOMES = new Set(["solved", "failed"]);
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_DAY = 100000;
const MAX_MOVES = 64;

// A rate computed from a handful of attempts is worse than no rate: the first
// person to play a day would be told "100% solved it", which is true, useless,
// and reads as a broken number. Below this many attempts the day reports no
// rate at all and the client shows only a finishing position.
const MIN_SAMPLE = 10;

function cors(origin, allowed) {
    const headers = {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Vary: "Origin",
    };
    // An unlisted origin gets a valid response with no CORS grant, so the
    // browser refuses it. That is the intended outcome, not an error worth
    // returning a body about.
    if (allowed.includes(origin)) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
        headers["Access-Control-Allow-Headers"] = "Content-Type";
        headers["Access-Control-Max-Age"] = "86400";
    }
    return headers;
}

const json = (body, status, headers) =>
    new Response(JSON.stringify(body), { status, headers });

function parseDay(raw) {
    const day = Number(raw);
    if (!Number.isInteger(day) || Math.abs(day) > MAX_DAY) return null;
    return day;
}

/** Shape the numbers the client actually renders, so it never does the maths. */
function shape(day, totals, position) {
    const attempts = totals.attempts ?? 0;
    const solved = totals.solved ?? 0;
    return {
        day,
        attempts,
        solved,
        // Null covers both "nobody has played" and "too few have played to
        // mean anything". Zero would be wrong for the first case — it reads as
        // a brutally hard puzzle rather than an empty one.
        rate: attempts >= MIN_SAMPLE ? solved / attempts : null,
        ...(position != null ? { position } : {}),
    };
}

export async function handle(request, store, options = {}) {
    const allowed = options.allowedOrigins ?? [];
    const now = options.now ?? (() => Date.now());
    const origin = request.headers.get("Origin") ?? "";
    const headers = cors(origin, allowed);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    let url;
    try {
        url = new URL(request.url);
    } catch {
        return json({ error: "bad request" }, 400, headers);
    }

    if (url.pathname === "/api/stats" && request.method === "GET") {
        const day = parseDay(url.searchParams.get("day"));
        if (day === null) return json({ error: "bad day" }, 400, headers);
        return json(shape(day, await store.totals(day)), 200, headers);
    }

    if (url.pathname === "/api/attempt" && request.method === "POST") {
        let body;
        try {
            body = await request.json();
        } catch {
            return json({ error: "bad json" }, 400, headers);
        }

        const day = parseDay(body?.day);
        if (day === null) return json({ error: "bad day" }, 400, headers);
        if (!OUTCOMES.has(body?.outcome)) return json({ error: "bad outcome" }, 400, headers);
        if (typeof body?.clientId !== "string" || !CLIENT_ID.test(body.clientId)) {
            return json({ error: "bad clientId" }, 400, headers);
        }
        const moves =
            Number.isInteger(body?.moves) && body.moves >= 0 && body.moves <= MAX_MOVES
                ? body.moves
                : null;

        // One row per player per day, and solving always wins — the same rule
        // the client uses locally, so a player who fails, retries and solves
        // counts once, as solved. Without this the denominator would grow on
        // every retry and the solve rate would sag towards zero.
        const at = now();
        const position = await store.record({
            day,
            clientId: body.clientId,
            outcome: body.outcome,
            moves,
            at,
        });

        return json(shape(day, await store.totals(day), position), 200, headers);
    }

    return json({ error: "not found" }, 404, headers);
}
