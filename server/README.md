# Solve-rate service

Counts how many people attempted each daily puzzle and how many solved it, and
tells a solver where they finished. Runs as a Cloudflare Worker over a D1
(SQLite) database.

The site works without it. `PUBLIC_STATS_API` unset — the default — means the
client makes no requests at all and every page renders exactly as it did before
this existed. Everything below is optional.

## Deploying

You need a Cloudflare account; the free tier covers this many times over.

```sh
cd server
npx wrangler login

# Create the database, then paste the printed id into wrangler.toml.
npx wrangler d1 create fourdttt-stats

# Apply the schema to the remote database.
npx wrangler d1 execute fourdttt-stats --remote --file=./schema.sql

npx wrangler deploy
```

`wrangler deploy` prints the worker's URL. Two things then point the site at it:

1. In `wrangler.toml`, `ALLOWED_ORIGINS` must list the site's origin. It already
   has the production domain and `http://localhost:4321` for local work. An
   origin that is not listed gets a response with no CORS grant, which the
   browser refuses.
2. In GitHub, add a repository **variable** (not a secret — it ends up in the
   client bundle either way) named `PUBLIC_STATS_API`, set to the worker URL
   with no trailing slash. `.github/workflows/deploy.yml` already passes it
   through to the build.

Push, and the deployed site starts reporting.

To try it locally before deploying:

```sh
npx wrangler dev --local          # serves on http://localhost:8787
PUBLIC_STATS_API=http://localhost:8787 npm run dev
```

## What it stores

One row per player per day:

| column | |
|---|---|
| `day` | the rotation day number, from `src/scripts/daily.js` |
| `client_id` | a random id the browser generates for itself |
| `outcome` | `solved` or `failed` |
| `moves` | moves used |
| `first_seen`, `solved_at` | timestamps, server clock |

No accounts, no IP addresses, and **no timing of play**. Timing was left out
deliberately: a client-reported clock cannot be trusted, and storing it invites
ranking by it, which only works if the server runs the game.

## Two rules that keep the numbers honest

**One row per player per day, and solving always wins.** A player who fails,
retries and solves counts once, as solved. Without this every retry would add to
the denominator and the rate would sag towards zero — and it would contradict
the client, where a day counts as solved if it was ever solved. Enforced by the
primary key plus the `ON CONFLICT` clause in `d1-store.js`.

**No rate until ten people have played.** Below that the service returns
`rate: null` and the client shows only a finishing position. The first player
of a day being told "100% solved it" is true, useless, and looks broken.

## Layout

| file | |
|---|---|
| `handler.js` | routing, validation, CORS, response shape. Knows only an abstract store. |
| `d1-store.js` | the SQL. **Porting to another host means writing another one of these — two methods — not touching `handler.js`.** |
| `worker.js` | Cloudflare entry point, deliberately thin. |
| `schema.sql` | table and index. |

## Tests

`npm test` runs `tests/corpus.test.mjs`, which re-proves the shipped puzzle
corpus. It does not cover this service.

The service is deliberately split so that `handler.js` depends only on an
abstract store, which is what makes it straightforward to exercise without
Cloudflare: construct a store backed by a Map, or by node built-in SQLite via a
shim presenting D1s prepare/bind/first interface, and call `handle()` directly.
D1 is SQLite, so statements checked that way are the ones Cloudflare runs.

## Known limit

`client_id` is self-asserted, so someone determined could inflate counts by
minting ids. For a solve rate the incentive is close to zero and the primary key
bounds what one id can do. If it ever matters, the fix is IP-based rate limiting
in the worker, which Cloudflare provides cheaply. It is deliberately not built
yet rather than built as something that looks like protection and is not.
