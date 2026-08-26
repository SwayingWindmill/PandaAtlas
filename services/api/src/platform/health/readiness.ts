import { Injectable } from "@nestjs/common";

export interface ReadinessProbe {
  check(): Promise<void>;
}

export const READINESS_PROBE = Symbol("READINESS_PROBE");

@Injectable()
export class LocalReadinessProbe implements ReadinessProbe {
  public async check(): Promise<void> {}
}
