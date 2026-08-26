import { HttpException } from "@nestjs/common";

export class ProblemException extends HttpException {
  public constructor(
    status: number,
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(detail, status);
  }
}
