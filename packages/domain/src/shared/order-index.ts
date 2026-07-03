import { ValidationError } from './errors.js';

class InvalidOrderIndexError extends ValidationError {
  constructor(value: number) {
    super(`Order index must be a non-negative integer, got: ${value}`);
  }
}

/**
 * A position within an ordered collection (chapters in a lecture, questions in
 * a chapter): a non-negative integer. A tiny value object that gives the
 * "order is a non-negative integer" rule one home rather than re-validating it
 * with an ad-hoc Zod chain at every boundary.
 */
export const OrderIndex = {
  /** Throws {@link ValidationError} if `value` is not a non-negative integer. */
  assert(value: number): number {
    if (!Number.isInteger(value) || value < 0) {
      throw new InvalidOrderIndexError(value);
    }
    return value;
  },

  isValid(value: number): boolean {
    return Number.isInteger(value) && value >= 0;
  },
};
