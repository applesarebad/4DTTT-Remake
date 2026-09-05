// Cloudflare Worker entry point. Deliberately thin: everything worth reading
// or testing is in handler.js.
//
// Deploy:
//   cd server
//   npx wrangler d1 create fourdttt-stats     # once; put the id in wrangler.toml
//   npx wrangler d1 execute fourdttt-stats --remote --file=./schema.sql
//   npx wrangler deploy
//
// Then point the site at it by setting PUBLIC_STATS_API to the worker URL
// before `npm run build`. Leave it unset and the site behaves exactly as it
// does today, with no stats and no network calls.

import { handle } from "./handler.js";
import { d1Store } from "./d1-store.js";

export default {
    async fetch(request, env) {
        const allowedOrigins = (env.ALLOWED_ORIGINS ?? "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);
        try {
            return await handle(request, d1Store(env.DB), { allowedOrigins });
        } catch (err) {
            // A broken stats service must never be able to break the game, so
            // it fails quietly and the client treats any error as "no stats".
            console.error("stats handler failed", err);
            return new Response(JSON.stringify({ error: "unavailable" }), {
                status: 503,
                headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            });
        }
    },
};
