import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { ProblemException } from "../http/problem.exception.js";
import { RequestContextService } from "../request-context/request-context.service.js";
import { IS_PUBLIC } from "./public.decorator.js";
import { setVerifiedIdentity } from "./request-auth.js";
import {
  AuthUnavailableError,
  InvalidSupabaseTokenError,
  SupabaseJwtVerifier,
} from "./supabase-jwt.verifier.js";

function bearerToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string") {
    return undefined;
  }
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  return match?.[1];
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  public constructor(
    private readonly reflector: Reflector,
    private readonly verifier: SupabaseJwtVerifier,
    private readonly requestContext: RequestContextService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = bearerToken(request);
    if (token === undefined) {
      throw new ProblemException(401, "auth.invalidToken", "A valid bearer token is required.");
    }

    try {
      const identity = await this.verifier.verify(token);
      setVerifiedIdentity(request, identity);
      this.requestContext.setAuthentication({
        actorId: identity.accountId,
        sessionId: identity.sessionId,
        aal: identity.aal,
        authenticatedAt: identity.authenticatedAt,
        authenticationMethod: identity.authenticationMethod,
        tokenIssuedAt: identity.issuedAt,
      });
      return true;
    } catch (error) {
      if (error instanceof AuthUnavailableError) {
        throw new ProblemException(
          503,
          "system.dependencyUnavailable",
          "Authentication verification is unavailable.",
        );
      }
      if (error instanceof InvalidSupabaseTokenError) {
        throw new ProblemException(401, "auth.invalidToken", "The bearer token is invalid.");
      }
      throw error;
    }
  }
}
