import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service.js";

export interface ReadinessProbe {
  check(): Promise<void>;
}

export const READINESS_PROBE = Symbol("READINESS_PROBE");

@Injectable()
export class DatabaseReadinessProbe implements ReadinessProbe {
  public constructor(private readonly database: DatabaseService) {}

  public async check(): Promise<void> {
    await this.database.checkReady();
  }
}
