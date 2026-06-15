/**
 * @athena/domain — the application & domain tier.
 *
 * Pure TypeScript with zero runtime dependencies: entities, value objects,
 * repository ports, domain errors, and use cases, organised by bounded
 * context (curriculum, speech, training). Presentation (`@athena/api`,
 * `apps/web`) and infrastructure (`apps/server`) both depend on this package;
 * it depends on neither.
 */

export * from './curriculum/index.js';
export * from './speech/index.js';
