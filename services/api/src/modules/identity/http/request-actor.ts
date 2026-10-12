import type { IncomingMessage as HttpRequest } from "node:http";
import type { ActorContext } from "../application/identity-access.types.js";

const ACTOR_CONTEXT = Symbol("actor-context");

type ActorRequest = HttpRequest & {
  [ACTOR_CONTEXT]?: ActorContext;
};

export function setActorContext(request: HttpRequest, actor: ActorContext): void {
  (request as ActorRequest)[ACTOR_CONTEXT] = actor;
}

export function getActorContext(request: HttpRequest): ActorContext | undefined {
  return (request as ActorRequest)[ACTOR_CONTEXT];
}
