import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { fixture } from "./fixture.ts";

// Server-side steps a journey needs between taps, run through the API's own compiled modules as production
// runs them: an editor's publication control, and the scheduled async cycle (a Cron Trigger in production)
// that projects notifications and processes privacy requests.

const apiDist = path.resolve(import.meta.dirname, "../../../../services/api/dist");

async function load<T>(relative: string): Promise<T> {
  // The modules read the same configuration as the API that stack.ts started.
  Object.assign(process.env, fixture().apiEnv);
  return (await import(pathToFileURL(path.join(apiDist, relative)).href)) as T;
}

interface Application {
  get<T>(token: unknown): T;
  close(): Promise<void>;
}

async function withApplication(work: (app: Application) => Promise<void>): Promise<void> {
  const { createApplication } = await load<{ createApplication(): Promise<Application> }>("bootstrap.js");
  const app = await createApplication();
  try {
    await work(app);
  } finally {
    await app.close();
  }
}

async function runCycles(app: Application, cycles: number): Promise<void> {
  const { AsyncDownstreamRunnerService } = await load<{ AsyncDownstreamRunnerService: unknown }>(
    "jobs/async-downstream-runner.service.js",
  );
  const runner = app.get<{ runCycle(effects: object): Promise<unknown> }>(AsyncDownstreamRunnerService);
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    await runner.runCycle({ publicCache: { purge: () => Promise.resolve() } });
  }
}

interface PgModule {
  default: {
    Pool: new (config: { connectionString: string }) => {
      query(sql: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
      end(): Promise<void>;
    };
  };
}

/** Backdates a fan's Supabase Auth interactive authentication claims so privacy routes require fresh OTP verification. */
export async function ageInteractiveAuth(email: string, minutes = 20): Promise<void> {
  const connectionString = fixture().apiEnv.DATABASE_URL;
  if (!connectionString) throw new Error("Missing DATABASE_URL in mobile e2e fixture.");
  const { default: pg } = (await import(
    pathToFileURL(path.resolve(import.meta.dirname, "../../../../node_modules/pg/esm/index.mjs")).href
  )) as PgModule;
  const pool = new pg.Pool({ connectionString });
  try {
    const agedAt = new Date(Date.now() - minutes * 60_000).toISOString();
    const sessions = await pool.query(
      `
        update auth.sessions s
        set created_at = $2::timestamptz,
            updated_at = $2::timestamptz
        from auth.users u
        where s.user_id = u.id
          and lower(u.email) = lower($1)
      `,
      [email, agedAt],
    );
    if (!sessions.rowCount) {
      throw new Error(`No auth session found for ${email}.`);
    }
    await pool.query(
      `
        update auth.mfa_amr_claims amr
        set created_at = $2::timestamptz,
            updated_at = $2::timestamptz
        from auth.sessions s
        join auth.users u on u.id = s.user_id
        where amr.session_id = s.id
          and lower(u.email) = lower($1)
      `,
      [email, agedAt],
    );
  } finally {
    await pool.end();
  }
}

/** Runs the scheduled async cycle a few times, enough for queued work to settle. */
export async function runScheduledCycles(cycles = 4): Promise<void> {
  await withApplication((app) => runCycles(app, cycles));
}

/** Takes a published panda down for review and restores it, which notifies its followers, then runs the cycle. */
export async function takeDownAndRestore(pandaId: string): Promise<void> {
  const { PUBLICATION_PORT } = await load<{ PUBLICATION_PORT: symbol }>(
    "modules/publication/application/publication.application.js",
  );
  await withApplication(async (app) => {
    const publication = app.get<{
      setResourceTakedown(kind: string, id: string, takenDown: boolean, context: object, reason: string): Promise<void>;
    }>(PUBLICATION_PORT);
    const context = { actor: { kind: "system", systemKey: "mobile-e2e" }, correlationId: randomUUID() };
    await publication.setResourceTakedown("panda", pandaId, true, context, "End-to-end review hold.");
    await publication.setResourceTakedown("panda", pandaId, false, context, "End-to-end review done.");
    await runCycles(app, 4);
  });
}
