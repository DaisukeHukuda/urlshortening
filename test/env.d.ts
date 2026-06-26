/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { D1Migration } from "cloudflare:test";

// `import { env } from "cloudflare:test"` is typed as `Cloudflare.Env`.
// `@cloudflare/workers-types` declares an empty `Cloudflare.Env`; we merge our
// bindings into it so tests get full typing.
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      ASSETS: Fetcher;
      AUTH_SECRET: string;
      ADMIN_USERNAMES: string;
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
