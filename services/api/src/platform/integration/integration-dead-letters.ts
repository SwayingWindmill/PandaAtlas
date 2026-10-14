import type { DatabaseService } from "../database/database.service.js";

// Queue messages a consumer gave up on (#629). Each one waits for an operator to replay or discard
// it, so any count above zero is reported as unhealthy.
export class IntegrationDeadLetters {
  public constructor(private readonly database: DatabaseService) {}

  public async count(): Promise<number> {
    const row = await this.database.db
      .selectFrom("integration.dead_letters")
      .select((expression) => expression.fn.countAll<string>().as("count"))
      .executeTakeFirstOrThrow();
    return Number(row.count);
  }
}
