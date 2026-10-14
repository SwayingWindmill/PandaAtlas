// What kind of rule a request broke. The HTTP layer maps each kind to a status in one place
// (ProblemDetailsFilter); code below it names the kind, never a status.
export type DomainErrorKind = "invalid" | "not_found" | "conflict" | "forbidden" | "unavailable";

// A failure the caller can act on: a broken business rule, a missing resource, a state conflict.
// Faults that indicate a bug or broken data are plain errors and surface as a logged 500.
export class DomainError extends Error {
  public constructor(
    public readonly kind: DomainErrorKind,
    public readonly code: string,
    public readonly detail: string,
  ) {
    super(detail);
    this.name = "DomainError";
  }
}
