/**
 * Base class for all domain-level errors. Use cases throw subclasses of this
 * so the presentation layer (tRPC routers) can map them to transport codes in
 * one place, instead of leaking bare `Error`s as `INTERNAL_SERVER_ERROR`.
 */
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A referenced aggregate or entity does not exist. Maps to `NOT_FOUND`. */
export abstract class NotFoundError extends DomainError {}

/** An invariant or value-object precondition was violated. Maps to `BAD_REQUEST`. */
export abstract class ValidationError extends DomainError {}
