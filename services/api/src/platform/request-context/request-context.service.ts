import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

export type AssuranceLevel = "aal1" | "aal2";

export interface RequestAuthenticationContext {
  actorId: string;
  sessionId: string;
  aal: AssuranceLevel;
  authenticatedAt: Date | undefined;
  authenticationMethod: string | undefined;
  tokenIssuedAt: Date;
}

export interface RequestAuthorizationContext {
  accountState: string;
  capabilityCount: number;
}

export interface RequestContextState {
  requestId: string;
  correlationId: string;
  startedAt: number;
  authentication?: RequestAuthenticationContext;
  authorization?: RequestAuthorizationContext;
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

  public setAuthentication(authentication: RequestAuthenticationContext): void {
    const current = this.storage.getStore();
    if (current !== undefined) {
      current.authentication = authentication;
    }
  }

  public setAuthorization(authorization: RequestAuthorizationContext): void {
    const current = this.storage.getStore();
    if (current !== undefined) {
      current.authorization = authorization;
    }
  }
}
