import { Module, ValidationPipe } from "@nestjs/common";
import { APP_FILTER, APP_PIPE } from "@nestjs/core";
import { RequestContextModule } from "../request-context/request-context.module.js";
import { ProblemDetailsFilter } from "./problem-details.filter.js";

@Module({
  imports: [RequestContextModule],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
          validationError: { target: false, value: false },
        }),
    },
    {
      provide: APP_FILTER,
      useClass: ProblemDetailsFilter,
    },
  ],
})
export class HttpPlatformModule {}
