import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContextState {
  requestId: string;
  correlationId: string;
  startedAt: number;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  public run(state: RequestContextState, callback: () => void): void {
    this.storage.run(state, callback);
  }

  public get current(): RequestContextState | undefined {
    return this.storage.getStore();
  }
}
