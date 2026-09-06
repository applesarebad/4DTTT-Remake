-- One row per player per day. The primary key is what keeps the solve rate
-- honest: a player who fails, retries and solves must count once, as solved,
-- or every retry would inflate the denominator and drag the rate towards zero.
CREATE TABLE IF NOT EXISTS attempts (
    day        INTEGER NOT NULL,
    client_id  TEXT    NOT NULL,
    outcome    TEXT    NOT NULL CHECK (outcome IN ('solved', 'failed')),
    moves      INTEGER,
    first_seen INTEGER NOT NULL,
    solved_at  INTEGER,
    hinted     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, client_id)
);

-- Serves both the totals query and the "you were Nth to finish" count.
CREATE INDEX IF NOT EXISTS attempts_day_solved ON attempts (day, solved_at);
