import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import { AppConfig } from "../config/app-config.js";
import type { Database } from "./database.types.js";

export type DatabaseTransaction = Transaction<Database>;

const POSTGRES_DATE_OID = 1082;
const postgresTypes: pg.CustomTypesConfig = {
  getTypeParser: (oid, format) => {
    if (Number(oid) === POSTGRES_DATE_OID) {
      return (value: string) => value;
    }
    return pg.types.getTypeParser(oid, format) as (value: string) => unknown;
  },
};

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly requests = new AsyncLocalStorage<{ db: Kysely<Database>; pool: pg.Pool }>();
  private readonly pool: pg.Pool | undefined;
  private readonly client: Kysely<Database> | undefined;

  public constructor(private readonly config: AppConfig) {
    if (config.databaseUrl === undefined) {
      return;
    }

    this.pool = this.createPool(config.databaseUrl);
    this.client = new Kysely<Database>({ dialect: new PostgresDialect({ pool: this.pool }) });
  }

  private createPool(connectionString: string): pg.Pool {
    const config = this.config;
    const pool = new pg.Pool({
      connectionString,
      ...(config.databaseSslCaCert === undefined
        ? {}
        : {
            ssl: {
              ca: config.databaseSslCaCert,
              rejectUnauthorized: true,
            },
          }),
      types: postgresTypes,
      max: config.databasePoolMax,
      min: 0,
      connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
      idleTimeoutMillis: config.databaseIdleTimeoutMs,
      maxLifetimeSeconds: config.databaseMaxLifetimeSeconds,
      statement_timeout: config.databaseStatementTimeoutMs,
      idle_in_transaction_session_timeout: config.databaseIdleTransactionTimeoutMs,
    });
    pool.on("error", (error) => {
      this.logger.error("PostgreSQL pool idle client error", error.stack ?? error.message);
    });
    return pool;
  }

  public get db(): Kysely<Database> {
    const client = this.requests.getStore()?.db ?? this.client;
    if (client === undefined) {
      throw new Error("DATABASE_URL is not configured");
    }
    return client;
  }

  public async withRequest<T>(connectionString: string, work: () => Promise<T>): Promise<T> {
    const pool = this.createPool(connectionString);
    const db = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
    try {
      return await this.requests.run({ db, pool }, work);
    } finally {
      await db.destroy();
    }
  }

  public async checkReady(): Promise<void> {
    await sql`select 1`.execute(this.db);
  }

  public async transaction<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(work);
  }

  public get poolStats(): { total: number; idle: number; waiting: number } {
    const pool = this.requests.getStore()?.pool ?? this.pool;
    return {
      total: pool?.totalCount ?? 0,
      idle: pool?.idleCount ?? 0,
      waiting: pool?.waitingCount ?? 0,
    };
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.client?.destroy();
  }
}
