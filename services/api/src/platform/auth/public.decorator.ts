import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = Symbol("is-public-route");

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
