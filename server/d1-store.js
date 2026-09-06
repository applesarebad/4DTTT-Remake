// D1 (SQLite) implementation of the store the handler expects.
//
// Porting the service to another host means writing another file like this
// one — two methods — rather than touching handler.js.

export function d1Store(db) {
    return {
        /**
         * Record one player's result for one day and return their finishing
         * position if they solved it, otherwise null.
         */
        async record({ day, clientId, outcome, moves, at, hinted }) {
            const solvedAt = outcome === "solved" ? at : null;
            // ON CONFLICT keeps this a single round trip and makes the
            // upgrade rule explicit: a solve overwrites an earlier failure,
            // and a later failure never overwrites a solve. COALESCE on
            // solved_at keeps the original finishing time if someone replays
            // a day they already solved.
            await db
                .prepare(
                    `INSERT INTO attempts (day, client_id, outcome, moves, first_seen, solved_at, hinted)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                     ON CONFLICT (day, client_id) DO UPDATE SET
                       outcome   = CASE WHEN attempts.outcome = 'solved' THEN 'solved' ELSE excluded.outcome END,
                       moves     = CASE WHEN attempts.outcome = 'solved' THEN attempts.moves ELSE excluded.moves END,
                       solved_at = COALESCE(attempts.solved_at, excluded.solved_at),
                       hinted    = MAX(attempts.hinted, excluded.hinted)`
                )
                .bind(day, clientId, outcome, moves, at, solvedAt, hinted ? 1 : 0)
                .run();

            if (outcome !== "solved") return null;

            const row = await db
                .prepare(
                    `SELECT COUNT(*) AS n FROM attempts
                     WHERE day = ?1 AND solved_at IS NOT NULL
                       AND solved_at <= (SELECT solved_at FROM attempts WHERE day = ?1 AND client_id = ?2)`
                )
                .bind(day, clientId)
                .first();
            return row?.n ?? null;
        },

        async totals(day) {
            const row = await db
                .prepare(
                    `SELECT COUNT(*) AS attempts,
                            SUM(CASE WHEN outcome = 'solved' THEN 1 ELSE 0 END) AS solved,
                            SUM(CASE WHEN outcome = 'solved' AND hinted = 0 THEN 1 ELSE 0 END) AS unaided
                     FROM attempts WHERE day = ?1`
                )
                .bind(day)
                .first();
            return { attempts: row?.attempts ?? 0, solved: row?.solved ?? 0, unaided: row?.unaided ?? 0 };
        },
    };
}
