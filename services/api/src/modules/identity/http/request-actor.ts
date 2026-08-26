import type { FastifyRequest } from "fastify";
import type { ActorContext } from "../application/identity-access.types.js";

const ACTOR_CONTEXT = Symbol("actor-context");

type ActorRequest = FastifyRequest & {
  [ACTOR_CONTEXT]?: ActorContext;
};

export function setActorContext(request: FastifyRequest, actor: ActorContext): void {
  (request as ActorRequest)[ACTOR_CONTEXT] = actor;
}

export function getActorContext(request: FastifyRequest): ActorContext | undefined {
  return (request as ActorRequest)[ACTOR_CONTEXT];
}
