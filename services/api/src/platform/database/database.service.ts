import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
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
  private readonly pool: pg.Pool | undefined;
  private readonly client: Kysely<Database> | undefined;

  public constructor(config: AppConfig) {
    if (config.databaseUrl === undefined) {
      return;
    }

    this.pool = new pg.Pool({
      connectionString: config.databaseUrl,
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
    this.client = new Kysely<Database>({ dialect: new PostgresDialect({ pool: this.pool }) });
  }

  public get db(): Kysely<Database> {
    if (this.client === undefined) {
      throw new Error("DATABASE_URL is not configured");
    }
    return this.client;
  }

  public async checkReady(): Promise<void> {
    await sql`select 1`.execute(this.db);
  }

  public async transaction<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(work);
  }

  public get poolStats(): { total: number; idle: number; waiting: number } {
    return {
      total: this.pool?.totalCount ?? 0,
      idle: this.pool?.idleCount ?? 0,
      waiting: this.pool?.waitingCount ?? 0,
    };
  }

  public async onApplicationShutdown(): Promise<void> {
    await this.client?.destroy();
  }
}
