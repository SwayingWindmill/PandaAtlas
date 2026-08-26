import { SetMetadata } from "@nestjs/common";
import type { AssuranceLevel } from "../application/identity-access.types.js";

export const REQUIRED_CAPABILITIES = Symbol("required-capabilities");
export const ALLOW_UNPROVISIONED = Symbol("allow-unprovisioned");
export const REQUIRE_RECENT_AUTH = Symbol("require-recent-auth");
export const REQUIRED_AAL = Symbol("required-aal");
export const ALLOW_SUSPENDED_ACCOUNT = Symbol("allow-suspended-account");

export const RequireCapabilities = (...capabilities: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_CAPABILITIES, capabilities);

export const AllowUnprovisioned = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_UNPROVISIONED, true);

export const RequireRecentAuth = (): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRE_RECENT_AUTH, true);

export const RequireAal = (aal: AssuranceLevel): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_AAL, aal);

export const AllowSuspendedAccount = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOW_SUSPENDED_ACCOUNT, true);
