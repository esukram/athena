// ponytail: a page-local counter is enough for a React key. crypto.randomUUID()
// would need a secure context (HTTPS or localhost).
let nextClientKey = 0;

/** Returns a key that stays unique for the lifetime of the page. */
export const newClientKey = (): string => `client-${nextClientKey++}`;
